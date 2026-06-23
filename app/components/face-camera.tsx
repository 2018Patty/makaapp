'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MODEL_URL = '/models'
const EAR_BLINK_THRESHOLD = 0.22  // Eye Aspect Ratio below this = blink
const ENROLL_FRAMES = 10           // Frames averaged for enrollment
const SCAN_FRAMES = 5              // Frames averaged for scan

type Phase = 'idle' | 'loading' | 'detecting' | 'liveness' | 'capturing' | 'done' | 'error'

interface Props {
  mode: 'enroll' | 'scan'
  onCaptured: (descriptor: number[]) => void
  onCancel: () => void
}

// Eye Aspect Ratio — ratio < threshold means eye is closed (blink)
function calcEAR(pts: Array<{ x: number; y: number }>): number {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  const v1 = dist(pts[1], pts[5])
  const v2 = dist(pts[2], pts[4])
  const h  = dist(pts[0], pts[3])
  return (v1 + v2) / (2 * h)
}

function averageDescriptors(descriptors: Float32Array[]): number[] {
  const result = new Float32Array(128)
  for (const d of descriptors) {
    for (let i = 0; i < 128; i++) result[i] += d[i]
  }
  const n = descriptors.length
  for (let i = 0; i < 128; i++) result[i] /= n
  return Array.from(result)
}

const PHASE_LABEL: Record<string, string> = {
  idle:       '',
  loading:    'กำลังโหลด AI model และขอสิทธิ์กล้อง...',
  detecting:  'จัดใบหน้าให้อยู่ในกรอบ',
  liveness:   'กระพริบตาช้าๆ 1 ครั้ง เพื่อยืนยันความเป็นมนุษย์',
  capturing:  'กำลังเก็บข้อมูลใบหน้า...',
  done:       'สำเร็จ',
  error:      '',
}

export function FaceCamera({ mode, onCaptured, onCancel }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef  = useRef<any>(null)

  // Phase stored in both ref (for RAF closure) and state (for render)
  const phaseRef        = useRef<Phase>('idle')
  const blinkCountRef   = useRef(0)
  const prevEarRef      = useRef(0.35)
  const captureFramesRef = useRef<Float32Array[]>([])
  const noFaceCountRef  = useRef(0)  // grace period — frames without face before reset

  const [phase, setPhaseState] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleCancel = useCallback(() => {
    stopCamera()
    onCancel()
  }, [stopCamera, onCancel])

  // Main detection loop — runs every animation frame while camera is active
  const detect = useCallback(async () => {
    const faceapi = faceapiRef.current
    const video   = videoRef.current
    const canvas  = canvasRef.current
    const curPhase = phaseRef.current

    if (!faceapi || !video || !canvas || curPhase === 'done' || curPhase === 'error' || curPhase === 'idle' || curPhase === 'loading') return

    try {
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      const result = await faceapi
        .detectSingleFace(video, opts)
        .withFaceLandmarks(true)
        .withFaceDescriptor()

      // Draw detection overlay (mirrored canvas matches mirrored video)
      const dims = { width: video.videoWidth || 320, height: video.videoHeight || 320 }
      faceapi.matchDimensions(canvas, dims)
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)

      if (result) {
        noFaceCountRef.current = 0
        const r = faceapi.resizeResults(result, dims)
        faceapi.draw.drawDetections(canvas, [r])
        faceapi.draw.drawFaceLandmarks(canvas, [r])

        if (curPhase === 'detecting') {
          setPhase('liveness')
          blinkCountRef.current = 0
          prevEarRef.current = 0.35
        }

        if (curPhase === 'liveness') {
          const le  = result.landmarks.getLeftEye()
          const re  = result.landmarks.getRightEye()
          const ear = (calcEAR(le) + calcEAR(re)) / 2

          // Rising edge detection: was open → now closed = blink
          if (prevEarRef.current > EAR_BLINK_THRESHOLD && ear <= EAR_BLINK_THRESHOLD) {
            blinkCountRef.current += 1
          }
          prevEarRef.current = ear

          if (blinkCountRef.current >= 1) {
            setPhase('capturing')
            captureFramesRef.current = []
            setProgress(0)
          }
        }

        if (curPhase === 'capturing') {
          captureFramesRef.current.push(result.descriptor)
          const needed = mode === 'enroll' ? ENROLL_FRAMES : SCAN_FRAMES
          const pct = Math.round((captureFramesRef.current.length / needed) * 100)
          setProgress(pct)

          if (captureFramesRef.current.length >= needed) {
            setPhase('done')
            stopCamera()
            onCaptured(averageDescriptors(captureFramesRef.current))
            return
          }
        }
      } else {
        // Lost face — wait 8 frames before resetting (handles brief dropout during blink)
        if (curPhase === 'liveness' || curPhase === 'capturing') {
          noFaceCountRef.current += 1
          if (noFaceCountRef.current > 8) {
            setPhase('detecting')
            setProgress(0)
            noFaceCountRef.current = 0
          }
        }
      }

      rafRef.current = requestAnimationFrame(() => { void detect() })
    } catch (err) {
      if (phaseRef.current !== 'done') {
        setPhase('error')
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตรวจจับใบหน้า'
        setErrorMsg(msg)
        stopCamera()
      }
    }
  }, [mode, onCaptured, setPhase, stopCamera])

  const start = useCallback(async () => {
    setPhase('loading')
    setErrorMsg('')
    try {
      const faceapi = await import('@vladmandic/face-api')
      faceapiRef.current = faceapi

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise<void>(res => {
          if (videoRef.current) videoRef.current.onloadedmetadata = () => res()
        })
        await videoRef.current.play()
      }

      setPhase('detecting')
      rafRef.current = requestAnimationFrame(() => { void detect() })
    } catch (err) {
      setPhase('error')
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setErrorMsg(
        msg.includes('Permission') || msg.includes('NotAllowed')
          ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตในเบราว์เซอร์แล้วลองใหม่'
          : msg,
      )
      stopCamera()
    }
  }, [setPhase, detect, stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  const scanSteps = [
    { label: 'จัดตำแหน่ง', sub: 'มองกล้อง', phases: ['detecting'] },
    { label: 'กระพริบตา', sub: 'liveness', phases: ['liveness'] },
    { label: 'เก็บข้อมูล', sub: 'ถ่ายภาพ', phases: ['capturing'] },
    { label: 'สำเร็จ', sub: 'เสร็จสิ้น', phases: ['done'] },
  ]

  const activeStepIndex = scanSteps.findIndex(s => s.phases.includes(phase))

  return (
    <div className="fc-root">

      {/* ── Camera column ─────────────────────────────── */}
      <div className="fc-camera-col">
        <div className="m-camera-frame">
          <div className="m-camera-corner tl" />
          <div className="m-camera-corner tr" />
          <div className="m-camera-corner bl" />
          <div className="m-camera-corner br" />

          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
          />

          {/* Oval face guide */}
          {(phase === 'detecting' || phase === 'liveness') && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <div style={{
                width: '55%', aspectRatio: '3/4', borderRadius: '50%',
                border: phase === 'liveness' ? '3px solid var(--accent)' : '3px dashed rgba(255,255,255,.55)',
                boxShadow: phase === 'liveness' ? '0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
                animation: phase === 'liveness' ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }} />
            </div>
          )}

          {/* Phase badge overlay */}
          {phase !== 'idle' && phase !== 'error' && (
            <div style={{
              position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 13,
              padding: '5px 16px', borderRadius: 20, whiteSpace: 'nowrap',
              fontFamily: '"Sarabun",sans-serif',
            }}>
              {PHASE_LABEL[phase]}
            </div>
          )}
        </div>
      </div>

      {/* ── Controls column ───────────────────────────── */}
      <div className="fc-controls-col">

        {/* Step bars */}
        <div>
          <div className="m-steps">
            {scanSteps.map((step, i) => (
              <div
                key={step.label}
                className={`m-step-bar ${i < activeStepIndex ? 'done' : i === activeStepIndex ? 'active' : ''}`}
              />
            ))}
          </div>
          <div className="m-step-labels">
            {scanSteps.map((step, i) => (
              <div
                key={step.label}
                className={`m-step-label ${i === activeStepIndex ? 'active' : ''}`}
              >
                {step.label}
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar during capture */}
        {phase === 'capturing' && (
          <div style={{ height: 4, background: 'var(--surface-soft)', borderRadius: 99 }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'var(--accent)', borderRadius: 99, transition: 'width .1s',
            }} />
          </div>
        )}

        {/* Instruction */}
        {phase !== 'idle' && phase !== 'error' && phase !== 'loading' && (
          <div className="m-scan-instruction">{PHASE_LABEL[phase]}</div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="auth-error">{errorMsg}</div>
        )}

        {/* Action button */}
        {(phase === 'idle' || phase === 'error') && (
          <button className="m-btn m-btn-salmon" onClick={start}>
            {phase === 'error' ? '🔄 ลองใหม่' : mode === 'enroll' ? 'เริ่มบันทึกใบหน้า' : 'เริ่มสแกน'}
          </button>
        )}
        {phase === 'loading' && (
          <button className="m-btn m-btn-salmon" disabled>
            กำลังโหลด AI model...
          </button>
        )}
        {(phase === 'detecting' || phase === 'liveness' || phase === 'capturing') && (
          <button className="m-btn m-btn-white" onClick={handleCancel}>
            ยกเลิก
          </button>
        )}
      </div>
    </div>
  )
}

'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FaceCamera } from '@/app/components/face-camera'
import { AvatarMenu } from '@/app/components/avatar-menu'

// ── Types ──────────────────────────────────────────────────────

type NavTab = 'home' | 'history' | 'profile'
type View   = NavTab | 'setup-face' | 'setup-course' | 'checkin' | 'checkin-pin' | 'checkin-done'

interface Profile {
  id: string
  full_name: string
  student_id: string | null
  faculty: string | null
  email: string
  role: string
  created_at: string
}

interface FaceTemplate { id: string; embedding: unknown }

interface ActiveSession {
  id: string
  course_id: string
  starts_at: string
  late_threshold_minutes: number
  latitude: number | null
  longitude: number | null
  session_pin: string | null
  courses: { code: string; name: string; room: string | null } | null
}

interface EnrolledCourse {
  course_id: string
  courses: { code: string; name: string; room: string | null } | null
}

interface AttendanceRow {
  id: string
  session_id: string
  status: 'on-time' | 'late' | 'absent'
  checked_at: string
  sessions: { starts_at: string; course_id: string; courses: { code: string; name: string } | null } | null
}

interface ScanResult {
  attendanceStatus: 'on-time' | 'late'
  courseName: string
  checkedAt: string
}

// ── Helpers ────────────────────────────────────────────────────

const MATCH_THRESHOLD = 0.55

function parseVector(v: unknown): number[] {
  if (Array.isArray(v)) return v as number[]
  if (typeof v === 'string') { try { return JSON.parse(v) as number[] } catch { return [] } }
  return []
}

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

function isLate(session: ActiveSession): boolean {
  const mins = (Date.now() - new Date(session.starts_at).getTime()) / 60000
  return mins > (session.late_threshold_minutes ?? 15)
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTh(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function todayTh() {
  return new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'สวัสดีตอนเช้า ☀️'
  if (h < 17) return 'สวัสดีตอนบ่าย 🌤️'
  return 'สวัสดีตอนเย็น 🌙'
}

// ── Edit Profile Sheet ─────────────────────────────────────────

function EditProfileSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile
  onClose: () => void
  onSaved: (updated: Profile) => void
}) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [studentId, setStudentId] = useState(profile.student_id ?? '')
  const [faculty, setFaculty] = useState(profile.faculty ?? '')
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setErr('')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name:  fullName.trim(),
        student_id: studentId.trim() || null,
        faculty:    faculty.trim()    || null,
      })
      .eq('id', profile.id)
      .select('id, full_name, student_id, faculty, email, role, created_at')
      .single<Profile>()

    if (error) { setErr(error.message); setBusy(false); return }
    if (data)  { onSaved(data); onClose() }
    setBusy(false)
  }

  return (
    <>
      <div className="m-overlay" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 20px' }}>แก้ไขข้อมูลส่วนตัว</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div className="auth-error">{err}</div>}

          <div className="m-form-field">
            <label>ชื่อ-นามสกุล <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
              required
            />
          </div>
          <div className="m-form-field">
            <label>รหัสนักศึกษา</label>
            <input
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              placeholder="เช่น 6510110001"
            />
          </div>
          <div className="m-form-field">
            <label>คณะ / สาขา</label>
            <input
              value={faculty}
              onChange={e => setFaculty(e.target.value)}
              placeholder="เช่น วิทยาการคอมพิวเตอร์"
            />
          </div>

          {/* Email — read-only */}
          <div className="m-form-field">
            <label style={{ color: 'var(--soft)' }}>อีเมล (ไม่สามารถแก้ไขได้)</label>
            <input value={profile.email} disabled style={{ background: 'var(--surface-soft)', color: 'var(--soft)' }} />
          </div>

          <button type="submit" className="m-btn m-btn-salmon" style={{ marginTop: 6 }} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className="m-btn m-btn-white" onClick={onClose}>ยกเลิก</button>
        </form>
      </div>
    </>
  )
}

// ── Join Course Sheet (home view) ──────────────────────────────

function JoinCourseSheet({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setBusy(true); setErr(''); setInfo('')
    const trimmed = code.trim().toUpperCase()

    const { data: course, error: findErr } = await supabase
      .from('courses')
      .select('id, code, name')
      .eq('join_code', trimmed)
      .single<{ id: string; code: string; name: string }>()

    if (findErr || !course) {
      setErr('ไม่พบรหัสห้องเรียน "' + trimmed + '" กรุณาตรวจสอบอีกครั้ง')
      setBusy(false); return
    }

    const { data: existing } = await supabase
      .from('course_members')
      .select('id')
      .eq('course_id', course.id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (existing) {
      setInfo('คุณลงทะเบียนวิชา "' + course.name + '" ไว้แล้ว')
      setBusy(false); return
    }

    const { error: joinErr } = await supabase
      .from('course_members')
      .insert({ course_id: course.id, profile_id: user.id })

    if (joinErr) { setErr(joinErr.message) }
    else { onJoined(); onClose() }
    setBusy(false)
  }

  return (
    <>
      <div className="m-overlay" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 6px' }}>เพิ่มวิชาเรียน</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--soft)', lineHeight: 1.6 }}>
          ขอรหัสวิชาจากอาจารย์ แล้วกรอกด้านล่าง
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err  && <div className="auth-error">{err}</div>}
          {info && <div className="auth-info">{info}</div>}
          <div className="m-form-field">
            <label>รหัสเข้าห้องเรียน (6 ตัวอักษร)</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="เช่น AB3K7X"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              style={{ letterSpacing: 4, fontFamily: 'monospace', fontSize: 20, fontWeight: 700 }}
              required
            />
          </div>
          <button type="submit" className="m-btn m-btn-salmon" disabled={busy}>
            {busy ? 'กำลังค้นหา...' : 'เพิ่มวิชา'}
          </button>
          <button type="button" className="m-btn m-btn-white" onClick={onClose}>ยกเลิก</button>
        </form>
      </div>
    </>
  )
}

// ── Component ──────────────────────────────────────────────────

export default function StudentPage() {
  const router = useRouter()
  const [view,           setView]      = useState<View>('home')
  const [profile,        setProfile]   = useState<Profile | null>(null)
  const [templates,      setTemplates] = useState<FaceTemplate[]>([])
  const [courses,        setCourses]   = useState<EnrolledCourse[]>([])
  const [sessionMap,     setSessions]  = useState<Record<string, ActiveSession>>({})
  const [attendance,     setAttendance]= useState<AttendanceRow[]>([])
  const [selectedSession,setSelected]  = useState<ActiveSession | null>(null)
  const [scanResult,     setScanResult]= useState<ScanResult | null>(null)
  const [pinInput,       setPinInput]  = useState('')
  const pinInputRef = useRef<HTMLInputElement>(null)
  const [statusMsg,      setStatus]    = useState('')
  const [busy,           setBusy]      = useState(true)
  const [showJoin,       setShowJoin]       = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [histCourse,     setHistCourse]= useState<string | null>(null)
  const [sessionCounts,  setSessionCounts] = useState<Record<string, number>>({})

  // Setup-course form
  const [setupCode, setSetupCode] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupErr,  setSetupErr]  = useState('')
  const [setupInfo, setSetupInfo] = useState('')

  const initialRouted = useRef(false)

  const loadData = useCallback(async (): Promise<{ templates: FaceTemplate[]; courses: EnrolledCourse[] } | undefined> => {
    if (!supabase) { router.push('/auth'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const [profRes, tmplRes, attnRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, student_id, faculty, email, role, created_at').eq('id', user.id).single<Profile>(),
      supabase.from('face_templates').select('id, embedding').eq('profile_id', user.id).eq('active', true),
      supabase.from('attendance')
        .select('id, session_id, status, checked_at, sessions(starts_at, course_id, courses(code, name))')
        .eq('profile_id', user.id)
        .order('checked_at', { ascending: false })
        .limit(500),
    ])

    const tmplData = tmplRes.data ?? []
    setProfile(profRes.data ?? null)
    setTemplates(tmplData)
    setAttendance((attnRes.data ?? []) as unknown as AttendanceRow[])

    const { data: memberships } = await supabase
      .from('course_members')
      .select('course_id, courses(code, name, room)')
      .eq('profile_id', user.id)

    const memberData = (memberships ?? []) as unknown as EnrolledCourse[]
    setCourses(memberData)

    // Load open sessions + total session counts for all enrolled courses
    const courseIds = memberData.map(m => m.course_id)
    if (courseIds.length > 0) {
      const [openRes, allRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, course_id, starts_at, late_threshold_minutes, latitude, longitude, session_pin, courses(code, name, room)')
          .eq('status', 'open')
          .in('course_id', courseIds),
        supabase
          .from('sessions')
          .select('id, course_id')
          .in('course_id', courseIds),
      ])

      const sMap: Record<string, ActiveSession> = {}
      for (const s of (openRes.data ?? [])) {
        sMap[s.course_id as string] = s as unknown as ActiveSession
      }
      setSessions(sMap)

      const countMap: Record<string, number> = {}
      for (const s of (allRes.data ?? [])) {
        const cid = s.course_id as string
        countMap[cid] = (countMap[cid] ?? 0) + 1
      }
      setSessionCounts(countMap)
    } else {
      setSessions({})
      setSessionCounts({})
    }

    setBusy(false)

    // Route new users to setup on first load
    if (!initialRouted.current) {
      initialRouted.current = true
      if (tmplData.length === 0) setView('setup-face')
    }

    return { templates: tmplData, courses: memberData }
  }, [router])

  useEffect(() => { void loadData() }, [loadData])

  // ── Sign out ──
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    router.push('/auth')
  }, [router])

  const unenrollCourse = async (courseId: string, courseName: string) => {
    if (!supabase) return
    if (!window.confirm(`ออกจากวิชา "${courseName}" ?\n\nประวัติการเข้าเรียนยังคงอยู่`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('course_members').delete().eq('course_id', courseId).eq('profile_id', user.id)
    setCourses(prev => prev.filter(c => c.course_id !== courseId))
  }

  const deleteAccount = async () => {
    if (!supabase) return
    if (!window.confirm('ลบบัญชีนี้ถาวร?\n\nข้อมูลการเข้าเรียนจะยังคงอยู่ในระบบ แต่ไม่สามารถเข้าสู่ระบบได้อีก')) return
    const { error } = await supabase.rpc('delete_own_account')
    if (error) { alert('ลบบัญชีไม่ได้: ' + error.message); return }
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // ── Enroll face ──
  const handleEnrolled = useCallback(async (descriptor: number[]) => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBusy(true)
    setStatus('กำลังบันทึกข้อมูลใบหน้า...')
    await supabase.from('face_templates').update({ active: false }).eq('profile_id', user.id)
    const { error } = await supabase.from('face_templates').insert({
      profile_id: user.id, embedding: descriptor, quality_score: 0.95, active: true,
    })
    if (error) {
      setStatus('บันทึกไม่สำเร็จ: ' + error.message)
      setBusy(false)
      return
    }
    setStatus('')
    const result = await loadData()
    setView((result?.courses.length ?? 0) === 0 ? 'setup-course' : 'home')
    setBusy(false)
  }, [loadData])

  // ── Setup: join first course ──
  const handleSetupJoin = async () => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const trimmed = setupCode.trim().toUpperCase()
    if (!trimmed) { setSetupErr('กรุณากรอกรหัสวิชา'); return }

    setSetupBusy(true); setSetupErr(''); setSetupInfo('')

    const { data: course, error: findErr } = await supabase
      .from('courses')
      .select('id, name')
      .eq('join_code', trimmed)
      .single<{ id: string; name: string }>()

    if (findErr || !course) {
      setSetupErr('ไม่พบรหัสห้องเรียน "' + trimmed + '" กรุณาตรวจสอบอีกครั้ง')
      setSetupBusy(false); return
    }

    await supabase.from('course_members').upsert({ course_id: course.id, profile_id: user.id })
    setSetupInfo('เพิ่มวิชา "' + course.name + '" เรียบร้อย')
    await loadData()
    setView('home')
    setSetupBusy(false)
  }

  // ── Check-in: face scan ──
  const handleScanned = useCallback(async (descriptor: number[]) => {
    if (!supabase || !selectedSession) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBusy(true)
    setStatus('กำลังตรวจสอบใบหน้า...')

    // Geolocation check — only if session has a recorded location
    if (selectedSession.latitude != null && selectedSession.longitude != null) {
      setStatus('กำลังตรวจสอบตำแหน่ง...')
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000,
          })
        )
        const dist = haversineMeters(
          pos.coords.latitude, pos.coords.longitude,
          selectedSession.latitude, selectedSession.longitude,
        )
        if (dist > 10) {
          setStatus(`ไม่สามารถเช็คชื่อได้ — คุณอยู่ห่างจากห้องเรียน ${Math.round(dist)} เมตร (ต้องอยู่ภายใน 10 เมตร)`)
          setBusy(false)
          return
        }
      } catch {
        setStatus('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิดการเข้าถึง GPS แล้วลองใหม่')
        setBusy(false)
        return
      }
    }

    // Already checked in?
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, status')
      .eq('session_id', selectedSession.id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (existing) {
      setScanResult({
        attendanceStatus: existing.status as 'on-time' | 'late',
        courseName: selectedSession.courses?.name ?? '',
        checkedAt: new Date().toISOString(),
      })
      setStatus('')
      setBusy(false)
      setView('checkin-done')
      return
    }

    // Face matching
    let minDist = Infinity
    for (const t of templates) {
      const stored = parseVector(t.embedding)
      if (stored.length !== 128) continue
      const d = euclideanDist(descriptor, stored)
      if (d < minDist) minDist = d
    }

    if (minDist >= MATCH_THRESHOLD) {
      setStatus(`ตรวจสอบไม่ผ่าน (distance: ${minDist.toFixed(3)}) กรุณาลองใหม่`)
      setBusy(false)
      return
    }

    const attendanceStatus = isLate(selectedSession) ? 'late' : 'on-time'
    const now = new Date().toISOString()

    const { error } = await supabase.from('attendance').insert({
      session_id:  selectedSession.id,
      profile_id:  user.id,
      status:      attendanceStatus,
      checked_at:  now,
      method:      'face',
      similarity:  parseFloat(Math.max(0, 1 - minDist).toFixed(4)),
      marked_by:   user.id,
    })

    if (error) {
      setStatus('บันทึกไม่สำเร็จ: ' + error.message)
      setBusy(false)
      return
    }

    setScanResult({ attendanceStatus, courseName: selectedSession.courses?.name ?? '', checkedAt: now })
    setStatus('')
    setBusy(false)
    setView('checkin-done')
    void loadData()
  }, [selectedSession, templates, loadData])

  // ── Check-in: PIN ──
  const handlePinCheckin = async () => {
    if (!supabase || !selectedSession || pinInput.length !== 4) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBusy(true)

    // GPS check (same as face scan)
    if (selectedSession.latitude != null && selectedSession.longitude != null) {
      setStatus('กำลังตรวจสอบตำแหน่ง...')
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        )
        const dist = haversineMeters(
          pos.coords.latitude, pos.coords.longitude,
          selectedSession.latitude, selectedSession.longitude,
        )
        if (dist > 10) {
          setStatus(`ไม่สามารถเช็คชื่อได้ — คุณอยู่ห่างจากห้องเรียน ${Math.round(dist)} เมตร (ต้องอยู่ภายใน 10 เมตร)`)
          setBusy(false)
          return
        }
      } catch {
        setStatus('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิดการเข้าถึง GPS แล้วลองใหม่')
        setBusy(false)
        return
      }
    }

    // Verify PIN
    setStatus('กำลังตรวจสอบรหัส...')
    if (!selectedSession.session_pin) {
      setStatus('คาบนี้ยังไม่มีรหัส กรุณาปิดและเปิดคาบใหม่ หรือติดต่ออาจารย์')
      setBusy(false)
      return
    }
    if (selectedSession.session_pin !== pinInput) {
      setStatus('รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสจากจอในห้องเรียนอีกครั้ง')
      setBusy(false)
      return
    }

    // Already checked in?
    const { data: existing } = await supabase
      .from('attendance').select('id, status')
      .eq('session_id', selectedSession.id).eq('profile_id', user.id).maybeSingle()

    if (existing) {
      setScanResult({
        attendanceStatus: existing.status as 'on-time' | 'late',
        courseName: selectedSession.courses?.name ?? '',
        checkedAt: new Date().toISOString(),
      })
      setStatus(''); setBusy(false); setView('checkin-done')
      return
    }

    const attendanceStatus = isLate(selectedSession) ? 'late' : 'on-time'
    const now = new Date().toISOString()
    const { error } = await supabase.from('attendance').insert({
      session_id: selectedSession.id,
      profile_id: user.id,
      status:     attendanceStatus,
      checked_at: now,
      method:     'pin',
      similarity: null,
      marked_by:  user.id,
    })

    if (error) { setStatus('บันทึกไม่สำเร็จ: ' + error.message); setBusy(false); return }

    setScanResult({ attendanceStatus, courseName: selectedSession.courses?.name ?? '', checkedAt: now })
    setStatus(''); setBusy(false); setPinInput('')
    setView('checkin-done')
    void loadData()
  }

  // ── Loading ──
  if (busy && !profile) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 18, fontSize: 22 }}>M</div>
          <div className="spinner" />
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  const initial     = (profile?.full_name ?? '?')[0]
  const hasTemplate = templates.length > 0

  // ── Setup: บันทึกใบหน้า ──
  if (view === 'setup-face') {
    return (
      <div className="stu-setup">
        <div className="stu-setup-head">
          <div className="stu-setup-brand">
            <div className="brand-mark" style={{ width: 36, height: 36, borderRadius: 12, fontSize: 16 }}>M</div>
            Maka
          </div>
          <div className="stu-step-badge">ขั้นตอนที่ 1 จาก 2</div>
          <h2>บันทึกใบหน้าของคุณ</h2>
          <p>ใบหน้าของคุณใช้เพื่อเช็คชื่อเข้าเรียน ระบบจัดเก็บเป็น face embedding เท่านั้น ไม่มีการเก็บรูปภาพจริง</p>
        </div>
        {statusMsg && <div className="auth-error" style={{ margin: '0 24px 12px' }}>{statusMsg}</div>}
        <div className="fc-page-content">
          <FaceCamera mode="enroll" onCaptured={handleEnrolled} onCancel={() => router.push('/auth')} />
        </div>
      </div>
    )
  }

  // ── Setup: เพิ่มรหัสวิชา ──
  if (view === 'setup-course') {
    return (
      <div className="stu-setup">
        <div className="stu-setup-head">
          <div className="stu-setup-brand">
            <div className="brand-mark" style={{ width: 36, height: 36, borderRadius: 12, fontSize: 16 }}>M</div>
            Maka
          </div>
          <div className="stu-step-badge">ขั้นตอนที่ 2 จาก 2</div>
          <h2>เพิ่มรหัสวิชา</h2>
          <p>ขอรหัสวิชาจากอาจารย์ แล้วกรอกด้านล่างเพื่อเข้าร่วมชั้นเรียน</p>
        </div>
        <div className="stu-setup-form">
          {setupErr  && <div className="auth-error">{setupErr}</div>}
          {setupInfo && <div className="auth-info">{setupInfo}</div>}
          <div className="m-form-field">
            <label>รหัสเข้าห้องเรียน (6 ตัวอักษร)</label>
            <input
              value={setupCode}
              onChange={e => setSetupCode(e.target.value.toUpperCase())}
              placeholder="เช่น AB3K7X"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              style={{ letterSpacing: 4, fontFamily: 'monospace', fontSize: 20, fontWeight: 700 }}
            />
          </div>
          <button className="m-btn m-btn-salmon" onClick={handleSetupJoin} disabled={setupBusy}>
            {setupBusy ? 'กำลังค้นหา...' : 'เพิ่มวิชา'}
          </button>
          <button className="m-btn m-btn-white" onClick={() => setView('home')}>
            ข้ามขั้นตอนนี้
          </button>
        </div>
      </div>
    )
  }

  // ── Check-in: สแกนใบหน้า ──
  if (view === 'checkin') {
    return (
      <div className="m-scan-page">
        <div className="m-scroll">
          <div className="m-scan-topbar">
            <button className="m-back-btn" onClick={() => { setStatus(''); setSelected(null); setView('home') }}>‹</button>
            <h3>เช็คชื่อ · {selectedSession?.courses?.name}</h3>
            <div style={{ width: 36 }} />
          </div>
          {statusMsg && <div className="auth-error" style={{ margin: '0 20px 14px' }}>{statusMsg}</div>}
          <div className="fc-page-content">
            <FaceCamera
              mode="scan"
              onCaptured={handleScanned}
              onCancel={() => { setStatus(''); setSelected(null); setView('home') }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Check-in: PIN entry ──
  if (view === 'checkin-pin') {
    const goBack = () => { setStatus(''); setPinInput(''); setSelected(null); setView('home') }
    return (
      <div className="m-scan-page">
        <div className="m-scroll">
          <div className="m-scan-topbar">
            <button className="m-back-btn" onClick={goBack}>‹</button>
            <h3>รหัสคาบ · {selectedSession?.courses?.name}</h3>
            <div style={{ width: 36 }} />
          </div>

          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info banner */}
            <div style={{
              background: 'color-mix(in srgb, var(--accent) 8%, #fff)',
              border: '1.5px solid color-mix(in srgb, var(--accent) 22%, transparent)',
              borderRadius: 16, padding: '14px 16px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>📺</span>
              <div>
                <p style={{ margin: '0 0 3px', fontFamily: '"Mitr",sans-serif', fontSize: 14, fontWeight: 600 }}>
                  ดูรหัส 4 หลักจากจอในห้องเรียน
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)', lineHeight: 1.5 }}>
                  อาจารย์จะแสดงรหัสบนจอโปรเจกเตอร์ พิมพ์รหัสด้านล่างเพื่อเช็คชื่อเข้าเรียน
                </p>
              </div>
            </div>

            {statusMsg && <div className="auth-error">{statusMsg}</div>}

            {/* PIN input */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--soft)', textAlign: 'center' }}>
                แตะที่ช่องด้านล่าง แล้วพิมพ์รหัส 4 หลัก
              </p>
              {/* Boxes + transparent overlay input */}
              <div
                style={{ position: 'relative', display: 'inline-flex', gap: 12, cursor: 'text' }}
                onClick={() => pinInputRef.current?.focus()}
              >
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 60, height: 68, borderRadius: 14,
                      border: `2.5px solid ${pinInput.length === i ? 'var(--accent)' : pinInput.length > i ? 'var(--good)' : 'var(--line)'}`,
                      display: 'grid', placeItems: 'center',
                      background: pinInput.length > i ? 'color-mix(in srgb, var(--good) 8%, #fff)' : '#fff',
                      fontFamily: 'monospace', fontSize: 30, fontWeight: 800,
                      color: 'var(--ink)', transition: 'all 0.12s',
                    }}
                  >
                    {pinInput[i] ?? ''}
                  </div>
                ))}
                {/* Transparent overlay — captures tap and keyboard on mobile */}
                <input
                  ref={pinInputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinInput}
                  autoFocus
                  onChange={e => { setStatus(''); setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
                  style={{
                    position: 'absolute', inset: 0,
                    opacity: 0, width: '100%', height: '100%',
                    cursor: 'text', fontSize: 16,
                  }}
                />
              </div>
            </div>

            <button
              className="m-btn m-btn-salmon"
              disabled={pinInput.length !== 4 || busy}
              style={{ opacity: pinInput.length !== 4 ? 0.5 : 1 }}
              onClick={() => void handlePinCheckin()}
            >
              {busy ? 'กำลังตรวจสอบ...' : 'ยืนยันเช็คชื่อ'}
            </button>
            <button className="m-btn m-btn-white" onClick={goBack}>ยกเลิก</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Check-in done: ยืนยันสำเร็จ ──
  if (view === 'checkin-done' && scanResult) {
    return (
      <div className="stu-done-page">
        <div className="m-success-icon">✓</div>
        <h2>เช็คชื่อสำเร็จ!</h2>
        <p>บันทึกการเข้าเรียนเรียบร้อยแล้ว</p>
        <div className="m-card" style={{ width: '100%', textAlign: 'left', marginBottom: 20 }}>
          <div className="m-detail-row">
            <span>วิชา</span>
            <strong>{scanResult.courseName}</strong>
          </div>
          <div className="m-detail-row">
            <span>เวลา</span>
            <strong>วันนี้ {formatTime(scanResult.checkedAt)}</strong>
          </div>
          <div className="m-detail-row">
            <span>สถานะ</span>
            <span className={`label ${scanResult.attendanceStatus === 'on-time' ? 'good' : 'warn'}`}>
              {scanResult.attendanceStatus === 'on-time' ? 'ตรงเวลา ✓' : 'มาสาย ⏰'}
            </span>
          </div>
        </div>
        <button
          className="m-btn m-btn-salmon"
          style={{ width: '100%', maxWidth: 360 }}
          onClick={() => { setScanResult(null); setSelected(null); setView('home') }}
        >
          กลับหน้าหลัก
        </button>
        <button
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--soft)', fontSize: 14, cursor: 'pointer' }}
          onClick={() => { setScanResult(null); setSelected(null); setView('history') }}
        >
          ดูประวัติการเข้าเรียน ›
        </button>
      </div>
    )
  }

  // ── History tab ──
  if (view === 'history') {
    // ── Detail: per-course attendance list ──
    if (histCourse) {
      const courseRec   = courses.find(c => c.course_id === histCourse)
      const courseAttn  = attendance.filter(a => a.sessions?.course_id === histCourse)
      const cOnTime     = courseAttn.filter(a => a.status === 'on-time').length
      const cLate       = courseAttn.filter(a => a.status === 'late').length
      const totalSess   = sessionCounts[histCourse] ?? courseAttn.length
      const cAbsent     = Math.max(0, totalSess - cOnTime - cLate)
      const pct         = totalSess > 0 ? Math.round(((cOnTime + cLate) / totalSess) * 100) : 0

      return (
        <div className="m-page">
          <div className="m-scroll">
            <div className="m-tab-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="m-back-btn"
                style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}
                onClick={() => setHistCourse(null)}
              >‹</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {courseRec?.courses?.code} · {courseRec?.courses?.name}
                </h2>
                {courseRec?.courses?.room && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--soft)' }}>
                    ห้อง {courseRec.courses.room}
                  </p>
                )}
              </div>
              <AvatarMenu name={profile?.full_name ?? ''} email={profile?.email} onSignOut={signOut} />
            </div>

            <div className="m-pad m-gap">
              {/* Summary stats */}
              <div className="m-report-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="m-report-card">
                  <strong>{totalSess}</strong><span>คาบทั้งหมด</span>
                </div>
                <div className="m-report-card">
                  <strong style={{ color: 'var(--good)' }}>{cOnTime}</strong><span>ตรงเวลา</span>
                </div>
                <div className="m-report-card">
                  <strong style={{ color: 'var(--warn)' }}>{cLate}</strong><span>สาย</span>
                </div>
                <div className="m-report-card">
                  <strong style={{ color: 'var(--accent-2)' }}>{cAbsent}</strong><span>ขาด</span>
                </div>
              </div>

              {/* Attendance rate bar */}
              <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--soft)' }}>อัตราการเข้าเรียน</span>
                  <span style={{ fontFamily: '"Mitr",sans-serif', fontWeight: 700,
                    color: pct >= 80 ? 'var(--good)' : pct >= 60 ? 'var(--warn)' : 'var(--accent-2)' }}>
                    {pct}%
                  </span>
                </div>
                <div className="hist-prog-bar">
                  <div className="hist-prog-fill" style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? 'var(--good)' : pct >= 60 ? 'var(--warn)' : 'var(--accent-2)',
                  }} />
                </div>
              </div>

              {/* Detail list */}
              <h3 className="m-section-title" style={{ marginTop: 4 }}>บันทึกการเข้าเรียน</h3>
              {courseAttn.length === 0 ? (
                <div className="m-card" style={{ textAlign: 'center', color: 'var(--soft)', fontSize: 14, padding: '28px 16px' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  ยังไม่มีบันทึกการเข้าเรียนในวิชานี้
                </div>
              ) : courseAttn.map(a => (
                <div key={a.id} className="m-history-row">
                  <div className="m-history-icon" style={{
                    background: a.status === 'on-time' ? 'var(--good-soft)' : a.status === 'late' ? 'var(--warn-soft)' : 'var(--surface-soft)',
                  }}>
                    {a.status === 'on-time' ? '✓' : a.status === 'late' ? '⏰' : '✗'}
                  </div>
                  <div className="m-list-main">
                    <h4>{formatDateTh(a.checked_at)}</h4>
                    <p>{formatTime(a.checked_at)}</p>
                  </div>
                  <span className={`label ${a.status === 'on-time' ? 'good' : a.status === 'late' ? 'warn' : 'muted'}`}>
                    {a.status === 'on-time' ? 'ตรงเวลา' : a.status === 'late' ? 'สาย' : 'ขาด'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <BottomNav tab="history" onTab={t => { setHistCourse(null); setView(t) }} />
        </div>
      )
    }

    // ── Overview: overall stats + per-course cards ──
    const totalAttn = attendance.filter(a => a.status !== 'absent').length
    const allOnTime = attendance.filter(a => a.status === 'on-time').length
    const allLate   = attendance.filter(a => a.status === 'late').length
    const totalSessAll = Object.values(sessionCounts).reduce((s, n) => s + n, 0)
    const allAbsent = Math.max(0, totalSessAll - allOnTime - allLate)

    return (
      <div className="m-page">
        <div className="m-scroll">
          <div className="m-tab-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 24, margin: 0 }}>ประวัติการเข้าเรียน</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--soft)' }}>
                {profile?.full_name ?? ''} · {profile?.student_id ?? profile?.email}
              </p>
            </div>
            <AvatarMenu name={profile?.full_name ?? ''} email={profile?.email} onSignOut={signOut} />
          </div>

          <div className="m-pad m-gap">
            {/* Overall summary */}
            <div className="m-report-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="m-report-card">
                <strong>{totalAttn}</strong><span>มาเรียน</span>
              </div>
              <div className="m-report-card">
                <strong style={{ color: 'var(--good)' }}>{allOnTime}</strong><span>ตรงเวลา</span>
              </div>
              <div className="m-report-card">
                <strong style={{ color: 'var(--warn)' }}>{allLate}</strong><span>สาย</span>
              </div>
              <div className="m-report-card">
                <strong style={{ color: 'var(--accent-2)' }}>{allAbsent}</strong><span>ขาด</span>
              </div>
            </div>

            {/* Per-course cards */}
            <h3 className="m-section-title" style={{ marginTop: 4 }}>สรุปรายวิชา</h3>
            {courses.length === 0 ? (
              <div className="m-card" style={{ textAlign: 'center', color: 'var(--soft)', fontSize: 14, padding: '28px 16px' }}>
                ยังไม่ได้เพิ่มวิชาใด
              </div>
            ) : courses.map(m => {
              const ca        = attendance.filter(a => a.sessions?.course_id === m.course_id)
              const cOnTime   = ca.filter(a => a.status === 'on-time').length
              const cLate     = ca.filter(a => a.status === 'late').length
              const totalSess = sessionCounts[m.course_id] ?? ca.length
              const cAbsent   = Math.max(0, totalSess - cOnTime - cLate)
              const pct       = totalSess > 0 ? Math.round(((cOnTime + cLate) / totalSess) * 100) : 0

              return (
                <button
                  key={m.course_id}
                  className="hist-course-card"
                  onClick={() => setHistCourse(m.course_id)}
                >
                  <div className="hist-course-top">
                    <div className="hist-course-icon">📖</div>
                    <div className="hist-course-info">
                      <h4>{m.courses?.code} · {m.courses?.name}</h4>
                      {m.courses?.room && <p>ห้อง {m.courses.room}</p>}
                    </div>
                    <span className="hist-course-arrow">›</span>
                  </div>
                  <div className="hist-prog-row">
                    <div className="hist-prog-bar">
                      <div className="hist-prog-fill" style={{
                        width: `${pct}%`,
                        background: pct >= 80 ? 'var(--good)' : pct >= 60 ? 'var(--warn)' : 'var(--accent-2)',
                      }} />
                    </div>
                    <span className="hist-prog-pct" style={{
                      color: pct >= 80 ? 'var(--good)' : pct >= 60 ? 'var(--warn)' : 'var(--accent-2)',
                    }}>{pct}%</span>
                  </div>
                  <div className="hist-stats-row">
                    <span className="hist-stat on-time">✓ {cOnTime} ตรงเวลา</span>
                    <span className="hist-stat late">⏰ {cLate} สาย</span>
                    <span className="hist-stat absent">✗ {cAbsent} ขาด</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        <BottomNav tab="history" onTab={t => setView(t)} />
      </div>
    )
  }

  // ── Profile tab ──
  if (view === 'profile') {
    const joinDate = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      : null

    return (
      <div className="m-page">
        <div className="m-scroll">

          {/* Header */}
          <div className="m-tab-header" style={{ paddingBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 22, margin: 0 }}>โปรไฟล์</h2>
              <AvatarMenu name={profile?.full_name ?? ''} email={profile?.email} onSignOut={signOut} />
            </div>
          </div>

          <div className="m-pad m-gap">

            {/* Avatar + name */}
            <div className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="m-avatar-circle-lg" style={{ flexShrink: 0 }}>{initial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 18, margin: '0 0 3px', wordBreak: 'break-word' }}>
                  {profile?.full_name ?? '—'}
                </h3>
                <span className="label muted" style={{ fontSize: 11 }}>นักศึกษา</span>
              </div>
            </div>

            {/* Info rows */}
            <div className="m-card m-gap">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 14, margin: 0, color: 'var(--soft)' }}>
                  ข้อมูลส่วนตัว
                </h4>
                <button
                  title="แก้ไขข้อมูล"
                  onClick={() => setShowEditProfile(true)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)',
                    background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
                    color: 'var(--soft)',
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              {[
                { label: 'รหัสนักศึกษา', value: profile?.student_id ?? '—', mono: true },
                { label: 'ชื่อ-นามสกุล', value: profile?.full_name ?? '—' },
                { label: 'อีเมล',         value: profile?.email ?? '—' },
                { label: 'คณะ / สาขา',   value: profile?.faculty ?? '—' },
                { label: 'สมัครเมื่อ',   value: joinDate ?? '—' },
              ].map(row => (
                <div key={row.label} className="m-detail-row">
                  <span>{row.label}</span>
                  <strong style={row.mono ? { fontFamily: 'monospace', letterSpacing: 1 } : undefined}>
                    {row.value}
                  </strong>
                </div>
              ))}
            </div>

            {/* Face template */}
            <div className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 22,
                background: hasTemplate ? 'var(--good-soft)' : 'var(--warn-soft)', flexShrink: 0,
              }}>
                {hasTemplate ? '😊' : '👤'}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 15, margin: '0 0 2px' }}>ข้อมูลใบหน้า</h4>
                <p style={{ margin: 0, fontSize: 12, color: hasTemplate ? 'var(--good)' : 'var(--warn)' }}>
                  {hasTemplate ? 'ลงทะเบียนแล้ว · พร้อมเช็คชื่อ' : 'ยังไม่ได้ลงทะเบียนใบหน้า'}
                </p>
              </div>
              <button
                className="m-btn m-btn-white m-btn-sm"
                style={{ width: 'auto', minWidth: 80, padding: '0 14px' }}
                onClick={() => { setStatus(''); setView('setup-face') }}
              >
                {hasTemplate ? 'อัปเดต' : 'บันทึก'}
              </button>
            </div>

            {/* Courses */}
            <div className="m-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 15, margin: 0 }}>
                  วิชาที่ลงทะเบียน
                  <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--soft)', fontWeight: 400 }}>
                    ({courses.length} วิชา)
                  </span>
                </h4>
                <button
                  className="m-btn m-btn-salmon m-btn-sm"
                  style={{ width: 'auto', padding: '0 12px', minHeight: 32, fontSize: 12 }}
                  onClick={() => setShowJoin(true)}
                >
                  + เพิ่มวิชา
                </button>
              </div>
              {courses.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--soft)', margin: 0, textAlign: 'center', padding: '8px 0' }}>
                  ยังไม่ได้ลงทะเบียนวิชาใด
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {courses.map(m => (
                    <div key={m.course_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>📖</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 14, fontFamily: '"Mitr",sans-serif', fontWeight: 600 }}>
                          {m.courses?.code}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)' }}>
                          {m.courses?.name}
                          {m.courses?.room ? ` · ห้อง ${m.courses.room}` : ''}
                        </p>
                      </div>
                      <button
                        title="ออกจากวิชา"
                        onClick={() => void unenrollCourse(m.course_id, m.courses?.name ?? m.course_id)}
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: '1px solid #fcc',
                          background: '#fff5f5', cursor: 'pointer', display: 'grid', placeItems: 'center',
                          color: '#e05c5c', flexShrink: 0,
                        }}
                      >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              className="m-btn m-btn-white"
              style={{ color: 'var(--accent-2)', marginTop: 4 }}
              onClick={signOut}
            >
              ออกจากระบบ
            </button>

            {/* Delete account */}
            <button
              className="m-btn m-btn-white"
              style={{ color: '#e05c5c', border: '1px solid #fcc', marginTop: 0 }}
              onClick={() => void deleteAccount()}
            >
              ลบบัญชีของฉัน
            </button>
          </div>
        </div>

        {showJoin && (
          <JoinCourseSheet onClose={() => setShowJoin(false)} onJoined={() => { void loadData() }} />
        )}
        {showEditProfile && profile && (
          <EditProfileSheet
            profile={profile}
            onClose={() => setShowEditProfile(false)}
            onSaved={updated => { setProfile(updated); setShowEditProfile(false) }}
          />
        )}
        <BottomNav tab="profile" onTab={t => setView(t)} />
      </div>
    )
  }

  // ── Home tab (course list + check-in) ──

  const startCheckin = (session: ActiveSession) => {
    setSelected(session)
    setStatus('')
    setView('checkin')
  }

  return (
    <div className="m-page">
      {showJoin && (
        <JoinCourseSheet onClose={() => setShowJoin(false)} onJoined={() => { void loadData() }} />
      )}
      <div className="m-scroll">

        {/* Greeting */}
        <div className="m-greeting">
          <div className="m-greeting-text">
            <small>{greeting()}</small>
            <h2>{profile?.full_name ?? 'นักศึกษา'}</h2>
          </div>
          <AvatarMenu name={profile?.full_name ?? ''} email={profile?.email} onSignOut={signOut} />
        </div>

        {/* Date chip */}
        <div style={{ padding: '12px 20px 0' }}>
          <div className="m-date-chip" style={{ margin: 0 }}>
            <span className="dot-red" />
            {todayTh()}
          </div>
        </div>

        {statusMsg && <div className="auth-error" style={{ margin: '12px 20px 0' }}>{statusMsg}</div>}

        <div className="m-pad m-gap" style={{ marginTop: 18 }}>

          {/* No face warning */}
          {!hasTemplate && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--warn-soft)', borderRadius: 16, padding: '12px 16px',
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 14, margin: '0 0 2px', color: 'var(--ink)' }}>
                  ยังไม่ได้บันทึกใบหน้า
                </h4>
                <p style={{ fontSize: 12, color: 'var(--soft)', margin: 0 }}>
                  บันทึกใบหน้าก่อนเพื่อเช็คชื่อได้
                </p>
              </div>
              <button
                className="m-btn m-btn-salmon m-btn-sm"
                style={{ width: 'auto', padding: '0 12px', minHeight: 34, flexShrink: 0 }}
                onClick={() => { setStatus(''); setView('setup-face') }}
              >
                บันทึก
              </button>
            </div>
          )}

          {/* Course list header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="m-section-title" style={{ margin: 0 }}>รายวิชาของฉัน</h3>
            <button
              className="m-btn m-btn-salmon m-btn-sm"
              style={{ width: 'auto', padding: '0 14px', minHeight: 36, borderRadius: 12, fontSize: 13 }}
              onClick={() => setShowJoin(true)}
            >
              + เพิ่มวิชา
            </button>
          </div>

          {/* Empty state */}
          {courses.length === 0 ? (
            <div className="m-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
              <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 16, margin: '0 0 8px' }}>
                ยังไม่ได้เพิ่มวิชาใด
              </h4>
              <p style={{ fontSize: 13, color: 'var(--soft)', margin: '0 0 16px' }}>
                กด "+ เพิ่มวิชา" แล้วใส่รหัสที่อาจารย์ให้
              </p>
              <button
                className="m-btn m-btn-salmon m-btn-sm"
                style={{ width: 'auto', padding: '0 24px', margin: '0 auto' }}
                onClick={() => setShowJoin(true)}
              >
                เพิ่มวิชาแรก
              </button>
            </div>
          ) : courses.map(m => {
            const session = sessionMap[m.course_id]
            const alreadyChecked = session
              ? attendance.some(a => a.session_id === session.id)
              : false

            return (
              <div key={m.course_id} className="stu-course-card">
                <div className="stu-course-top">
                  <div className="stu-course-icon">📖</div>
                  <div className="stu-course-name">
                    <h4>{m.courses?.code} · {m.courses?.name}</h4>
                    {m.courses?.room && <p>ห้อง {m.courses.room}</p>}
                  </div>
                </div>
                <div className="stu-course-bottom">
                  {session ? (
                    <>
                      <div className={`stu-session-status ${isLate(session) ? 'late' : 'active'}`}>
                        <span>{isLate(session) ? '⏰' : '●'}</span>
                        <span>{isLate(session) ? 'คาบเปิด · มาสาย' : 'คาบเปิดอยู่ · ทันเวลา'}</span>
                      </div>
                      {alreadyChecked ? (
                        <span className="label good">เช็คชื่อแล้ว ✓</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {hasTemplate && (
                            <button
                              className="m-btn m-btn-salmon m-btn-sm"
                              style={{ width: 'auto', padding: '0 14px', minHeight: 36 }}
                              onClick={() => startCheckin(session)}
                            >
                              📷 สแกนหน้า
                            </button>
                          )}
                          <button
                            className="m-btn m-btn-sm"
                            style={{
                              width: 'auto', padding: '0 14px', minHeight: 36,
                              background: 'color-mix(in srgb, var(--accent) 10%, #fff)',
                              color: 'var(--accent)', border: '1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                              borderRadius: 12,
                            }}
                            onClick={() => { setSelected(session); setPinInput(''); setStatus(''); setView('checkin-pin') }}
                          >
                            🔢 รหัสคาบ
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="stu-no-session">ยังไม่มีคาบเรียน</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <BottomNav tab="home" onTab={t => setView(t)} />
    </div>
  )
}

// ── Bottom Navigation ──────────────────────────────────────────

function BottomNav({ tab, onTab }: { tab: NavTab; onTab: (t: NavTab) => void }) {
  return (
    <div className="m-bottom-nav">
      <Link href="/auth" className="m-nav-logo">
        <div className="m-nav-logo-mark">M</div>
        <span className="m-nav-logo-text">Maka</span>
      </Link>
      <button className={`m-nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => onTab('home')}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path d="M3 9L12 2L21 9V20C21 20.6 20.6 21 20 21H15V15H9V21H4C3.4 21 3 20.6 3 20V9Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
            fill={tab === 'home' ? 'currentColor' : 'none'} fillOpacity={tab === 'home' ? 0.15 : 0} />
        </svg>
        หน้าหลัก
      </button>
      <button className={`m-nav-item ${tab === 'history' ? 'active' : ''}`} onClick={() => onTab('history')}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"
            fill={tab === 'history' ? 'currentColor' : 'none'} fillOpacity={tab === 'history' ? 0.12 : 0} />
          <path d="M8 9H16M8 13H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        ประวัติ
      </button>
      <button className={`m-nav-item ${tab === 'profile' ? 'active' : ''}`} onClick={() => onTab('profile')}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"
            fill={tab === 'profile' ? 'currentColor' : 'none'} fillOpacity={tab === 'profile' ? 0.15 : 0} />
          <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        โปรไฟล์
      </button>
    </div>
  )
}

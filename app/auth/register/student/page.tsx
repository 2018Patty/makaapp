'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegisterStudentPage() {
  const router = useRouter()
  const [fullName,   setFullName]   = useState('')
  const [studentId,  setStudentId]  = useState('')
  const [faculty,    setFaculty]    = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPass]       = useState('')
  const [error,      setError]      = useState('')
  const [info,       setInfo]       = useState('')
  const [busy,       setBusy]       = useState(false)
  const [pdpaAccepted, setPdpa]     = useState(false)
  const [showPdpa,     setShowPdpa] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError('Supabase ยังไม่ได้ตั้งค่า'); return }

    setBusy(true)
    setError('')
    setInfo('')
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) { setError(signUpErr.message); return }

      const user = data.user
      if (!user) {
        setInfo('สมัครเรียบร้อย กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี')
        return
      }

      await supabase.from('profiles').upsert({
        id:         user.id,
        role:       'student',
        full_name:  fullName.trim() || email.split('@')[0],
        student_id: studentId.trim() || null,
        faculty:    faculty.trim() || null,
        email,
        updated_at: new Date().toISOString(),
      })

      if (!data.session) {
        setInfo('สมัครเรียบร้อย กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีแล้วเข้าสู่ระบบ')
        return
      }
      router.push('/student')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="reg-page">

      {/* ── Left panel (desktop only) ── */}
      <div className="reg-panel">
        <Link href="/auth" className="reg-panel-back">← กลับหน้าหลัก</Link>
        <div className="reg-panel-brand">
          <img src="/brand/maka-logo.svg" alt="Maka" width={44} height={44} style={{ display: 'block', flexShrink: 0 }} />
          <span className="reg-panel-brandname">Maka</span>
        </div>
        <h2 className="reg-panel-title">ลงทะเบียน<br />นักศึกษา</h2>
        <p className="reg-panel-sub">สร้างบัญชีเพื่อเช็คชื่อเข้าเรียนด้วยใบหน้า</p>
        <ul className="reg-panel-list">
          <li>📷&nbsp; สแกนใบหน้าเช็คชื่อได้ทันที</li>
          <li>📊&nbsp; ดูสรุปสถิติการเข้าเรียน</li>
          <li>🛡️&nbsp; ปลอดภัย ไม่เก็บรูปภาพจริง</li>
        </ul>
      </div>

      {/* ── Right: form ── */}
      <div className="reg-right">

        {/* Mobile topbar (hidden on desktop) */}
        <div className="reg-mob-head">
          <Link href="/auth" className="m-back-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>‹</Link>
          <h2>ลงทะเบียนนักศึกษา</h2>
        </div>

        {/* Form card */}
        <div className="reg-card">
          <div className="reg-card-head">
            <h3>สร้างบัญชีนักศึกษา</h3>
            <p>บัญชีสำหรับเช็คชื่อด้วยใบหน้า ระบบเก็บเฉพาะ face embedding ไม่ใช่รูปภาพจริง</p>
          </div>

          <form onSubmit={handleSubmit} className="reg-form">
            {error && <div className="auth-error">{error}</div>}
            {info  && <div className="auth-info">{info}</div>}

            <div className="m-form-field">
              <label>ชื่อ-นามสกุล</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="เช่น ธนพล ใจดี"
                required
              />
            </div>

            <div className="reg-form-row">
              <div className="m-form-field">
                <label>รหัสนักศึกษา</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="เช่น 6512345"
                />
              </div>
              <div className="m-form-field">
                <label>คณะ / ภาควิชา</label>
                <input
                  type="text"
                  value={faculty}
                  onChange={e => setFaculty(e.target.value)}
                  placeholder="เช่น วิทยาการคอมฯ"
                />
              </div>
            </div>

            <div className="m-form-field">
              <label>อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="m-form-field">
              <label>รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={e => setPass(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            {/* PDPA Consent */}
            <div style={{
              border: '1.5px solid #e8d9b5', borderRadius: 14,
              background: '#fffdf5', padding: '14px 16px', fontSize: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16 }}>🛡️</span>
                  <strong style={{ fontFamily: '"Mitr",sans-serif', fontSize: 13, color: '#7a5c00' }}>
                    นโยบายความเป็นส่วนตัว (PDPA)
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPdpa(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: 'var(--accent)', flexShrink: 0, padding: 0,
                  }}
                >
                  {showPdpa ? 'ซ่อน ▲' : 'อ่านเพิ่มเติม ▼'}
                </button>
              </div>

              <p style={{ margin: '0 0 10px', color: '#5c4200', lineHeight: 1.6 }}>
                ระบบเก็บรวบรวมข้อมูลส่วนบุคคลของท่าน
                <strong>เพื่อวัตถุประสงค์ในการติดตามการเข้าเรียนของนักศึกษา</strong>
                ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              </p>

              {showPdpa && (
                <div style={{ borderTop: '1px solid #e8d9b5', paddingTop: 10, marginBottom: 10, color: '#5c4200', lineHeight: 1.7 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 600, fontFamily: '"Mitr",sans-serif', fontSize: 12 }}>ข้อมูลที่เก็บรวบรวม</p>
                  <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12 }}>
                    <li>ชื่อ-นามสกุล และรหัสนักศึกษา</li>
                    <li>อีเมล สำหรับการยืนยันตัวตน</li>
                    <li>คณะ / ภาควิชา</li>
                    <li>ข้อมูลใบหน้า (เฉพาะ face embedding ซึ่งเป็นตัวเลขทางคณิตศาสตร์ — ไม่เก็บรูปภาพจริง)</li>
                  </ul>
                  <p style={{ margin: '0 0 6px', fontWeight: 600, fontFamily: '"Mitr",sans-serif', fontSize: 12 }}>วัตถุประสงค์การใช้ข้อมูล</p>
                  <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12 }}>
                    <li>ตรวจสอบและบันทึกการเข้าเรียนผ่านการจดจำใบหน้า</li>
                    <li>จัดทำรายงานสถิติการเข้าเรียนให้อาจารย์และนักศึกษา</li>
                  </ul>
                  <p style={{ margin: '0 0 6px', fontWeight: 600, fontFamily: '"Mitr",sans-serif', fontSize: 12 }}>สิทธิ์ของท่าน</p>
                  <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12 }}>
                    <li>สิทธิ์เข้าถึงและแก้ไขข้อมูลส่วนบุคคลของตนเอง</li>
                    <li>สิทธิ์ขอลบข้อมูลและถอนความยินยอมได้ทุกเมื่อ</li>
                    <li>สิทธิ์คัดค้านหรือจำกัดการประมวลผลข้อมูล</li>
                  </ul>
                  <p style={{ margin: '0 0 4px', fontWeight: 600, fontFamily: '"Mitr",sans-serif', fontSize: 12 }}>ติดต่อผู้ควบคุมข้อมูลส่วนบุคคล</p>
                  <p style={{ margin: 0, fontSize: 12 }}>
                    หากมีข้อสงสัยหรือต้องการใช้สิทธิ์ กรุณาติดต่อ:{' '}
                    <a href="mailto:pattaraporn.w@psu.ac.th" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>
                      pattaraporn.w@psu.ac.th
                    </a>
                  </p>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={pdpaAccepted}
                  onChange={e => setPdpa(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: '#5c4200', lineHeight: 1.5 }}>
                  ฉันได้อ่านและ<strong>ยินยอมให้เก็บรวบรวมข้อมูลส่วนบุคคล</strong>เพื่อวัตถุประสงค์การติดตามการเข้าเรียนตามที่ระบุข้างต้น
                </span>
              </label>
            </div>

            <button type="submit" className="m-btn m-btn-salmon" disabled={busy || !pdpaAccepted}
              style={{ opacity: pdpaAccepted ? 1 : 0.5 }}
            >
              {busy ? 'กำลังสมัคร...' : 'ลงทะเบียน'}
            </button>
          </form>

          <div className="reg-signin-link">
            มีบัญชีอยู่แล้ว?&nbsp;<Link href="/auth">เข้าสู่ระบบ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

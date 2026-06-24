'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

const signInWithGoogle = async () => {
  if (!supabase) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export default function RegisterTeacherPage() {
  const router = useRouter()
  const [fullName,   setFullName]   = useState('')
  const [staffId,    setStaffId]    = useState('')
  const [faculty,    setFaculty]    = useState('')
  const [courseName, setCourseName] = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPass]       = useState('')
  const [error,      setError]      = useState('')
  const [info,       setInfo]       = useState('')
  const [busy,       setBusy]       = useState(false)

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

      const displayName = fullName.trim() || email.split('@')[0]

      await supabase.from('profiles').upsert({
        id:         user.id,
        role:       'teacher',
        full_name:  displayName,
        student_id: staffId.trim() || null,
        faculty:    faculty.trim() || null,
        email,
        updated_at: new Date().toISOString(),
      })

      if (courseName.trim()) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        const joinCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
        const code = courseName.trim().toUpperCase().replace(/\s+/g, '').slice(0, 10)
        await supabase.from('courses').insert({
          code,
          name:            courseName.trim(),
          join_code:       joinCode,
          instructor_id:   user.id,
          instructor_name: displayName,
        })
      }

      if (!data.session) {
        setInfo('สมัครเรียบร้อย กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีแล้วเข้าสู่ระบบ')
        return
      }
      router.push('/teacher')
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
        <h2 className="reg-panel-title">ลงทะเบียน<br />อาจารย์</h2>
        <p className="reg-panel-sub">สร้างบัญชีเพื่อเปิดคาบเรียนและดูรายชื่อการเข้าเรียน</p>
        <ul className="reg-panel-list">
          <li>📅&nbsp; เปิดคาบและดูรายชื่อเช็คชื่อ</li>
          <li>👥&nbsp; จัดการนักศึกษาในคาบ</li>
          <li>📤&nbsp; ส่งออกรายงานการเข้าเรียน</li>
        </ul>
      </div>

      {/* ── Right: form ── */}
      <div className="reg-right">

        {/* Mobile topbar (hidden on desktop) */}
        <div className="reg-mob-head">
          <Link href="/auth" className="m-back-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>‹</Link>
          <h2>ลงทะเบียนอาจารย์</h2>
        </div>

        {/* Form card */}
        <div className="reg-card">
          <div className="reg-card-head">
            <h3>สร้างบัญชีอาจารย์</h3>
            <p>บัญชีสำหรับเปิดคาบเรียนและดูรายชื่อการเข้าเรียน เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน</p>
          </div>

          {/* Google sign-up */}
          <button type="button" onClick={signInWithGoogle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '13px 0', borderRadius: 14, marginBottom: 16,
            border: '1.5px solid var(--line)', background: '#fff', cursor: 'pointer',
            fontFamily: '"Mitr",sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--ink)',
          }}>
            <GoogleIcon />
            สมัคร / เข้าสู่ระบบด้วย Google
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 12, color: 'var(--soft)' }}>หรือสมัครด้วยอีเมล</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
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
                placeholder="เช่น สมชาย มานะ"
                required
              />
            </div>

            <div className="reg-form-row">
              <div className="m-form-field">
                <label>รหัสบุคลากร</label>
                <input
                  type="text"
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  placeholder="เช่น T-10245"
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
              <label>
                วิชาที่สอน&nbsp;
                <span style={{ fontWeight: 400, color: 'var(--soft)', fontSize: 12 }}>(ไม่บังคับ — เพิ่มภายหลังได้)</span>
              </label>
              <input
                type="text"
                value={courseName}
                onChange={e => setCourseName(e.target.value)}
                placeholder="เช่น การเขียนโปรแกรมเว็บ"
              />
            </div>

            <div className="m-form-field">
              <label>อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@psu.ac.th"
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

            <button type="submit" className="m-btn m-btn-salmon" disabled={busy}>
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

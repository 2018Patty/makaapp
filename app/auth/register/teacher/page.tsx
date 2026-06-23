'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

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

type RoleHint = 'student' | 'teacher' | null
type View = 'landing' | 'sign-in'
type ProfileRow = { role: 'student' | 'teacher' | 'admin' }

function getDisplayName(email: string) {
  const local = email.split('@')[0]?.trim() ?? ''
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ') || 'ผู้ใช้งาน'
  )
}

export default function AuthPage() {
  const router = useRouter()
  const [view, setView]         = useState<View>('landing')
  const [roleHint, setRole]     = useState<RoleHint>(null)
  const [email, setEmail]       = useState('')
  const [password, setPass]     = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]   = useState(false)

  const resolveAndRedirect = async (userId: string) => {
    if (!supabase) { router.push('/student'); return }
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single<ProfileRow>()
    router.push(data?.role === 'teacher' || data?.role === 'admin' ? '/teacher' : '/student')
  }

  const ensureProfile = async (userId: string, userEmail: string) => {
    if (!supabase) return
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    if (existing) return
    await supabase.from('profiles').insert({
      id:        userId,
      role:      'student',
      full_name: getDisplayName(userEmail),
      email:     userEmail,
    })
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError('Supabase ยังไม่ได้ตั้งค่า'); return }
    setBusy(true)
    setError('')
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); return }
      const user = data.user
      if (!user) { setError('เข้าสู่ระบบไม่สำเร็จ'); return }
      await ensureProfile(user.id, user.email ?? email)
      await resolveAndRedirect(user.id)
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const enterSignIn = (role: RoleHint) => {
    setRole(role)
    setError('')
    setEmail('')
    setPass('')
    setView('sign-in')

    // ถ้า login อยู่แล้ว — redirect เงียบๆ ใน background
    if (supabase) {
      supabase.auth.getSession()
        .then(({ data }) => {
          if (data.session?.user) resolveAndRedirect(data.session.user.id)
        })
        .catch(() => {})
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="m-landing">
        <div className="m-landing-illo">
          <span style={{ fontSize: 48 }}>👤</span>
        </div>
        <div className="auth-error">
          กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local
        </div>
      </div>
    )
  }

  /* ── Sign-in view ── */
  if (view === 'sign-in') {
    return (
      <div className="m-signin-page">
        <div className="m-signin-inner">
          <div className="m-topbar">
            <button className="m-back-btn" onClick={() => setView('landing')}>‹</button>
            <h2>เข้าสู่ระบบ{roleHint === 'teacher' ? 'อาจารย์' : 'นักศึกษา'}</h2>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 280, height: 280, borderRadius: '50%',
              overflow: 'hidden', margin: '0 auto 16px',
            }}>
              <Image
                src={roleHint === 'teacher' ? '/TeacherLogin.png' : '/StudentLogin.png'}
                alt="Maka Login"
                width={280}
                height={280}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                priority
              />
            </div>
            <div className="m-brand-row" style={{ marginBottom: 4, justifyContent: 'center' }}>
              <img src="/brand/maka-logo.svg" alt="Maka" width={28} height={28} style={{ display: 'block', flexShrink: 0 }} />
              <span style={{ fontFamily: '"Mitr",sans-serif', fontSize: 19, color: 'var(--ink)' }}>Maka</span>
            </div>
            <p style={{ margin: '0 0 2px', fontFamily: '"Mitr",sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
              "มาค่ะ"
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)' }}>
              App เช็คชื่อเข้าเรียนด้วยใบหน้า
            </p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={signInWithGoogle}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '13px 0', borderRadius: 16, marginBottom: 4,
              border: '1.5px solid var(--line)', background: '#fff', cursor: 'pointer',
              fontFamily: '"Mitr",sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--ink)',
            }}
          >
            <GoogleIcon />
            เข้าสู่ระบบด้วย Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 12, color: 'var(--soft)' }}>หรือ</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="auth-error">{error}</div>}

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
                placeholder="รหัสผ่านของคุณ"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="m-btn m-btn-salmon" style={{ marginTop: 6 }} disabled={busy}>
              {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="m-divider-text" style={{ marginTop: 20 }}>ยังไม่มีบัญชี?</div>
          <Link
            href={roleHint === 'teacher' ? '/auth/register/teacher' : '/auth/register/student'}
            className="m-btn m-btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 54, borderRadius: 18, fontFamily: '"Mitr",sans-serif', fontSize: 16, textDecoration: 'none', border: '1.5px solid var(--accent)' }}
          >
            ลงทะเบียน{roleHint === 'teacher' ? 'อาจารย์' : 'นักศึกษา'}
          </Link>
        </div>
      </div>
    )
  }

  /* ── Landing view ── */
  return (
    <div className="m-landing">
      {/* Illustration */}
      <div className="m-landing-illo" style={{ padding: 0, background: '#f5f0e8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Image
          src="/students.png"
          alt="นักศึกษา"
          width={1512}
          height={1008}
          style={{ width: '100%', objectFit: 'contain' }}
          priority
        />
        <p style={{
          margin: '6px 0 10px',
          fontFamily: '"Caveat", cursive',
          fontSize: 22,
          fontWeight: 700,
          color: '#555',
          textAlign: 'center',
          letterSpacing: '0.01em',
        }}>
          Maka...Smile in. Learn on.
        </p>
      </div>

      <div className="m-landing-content">
        {/* Brand */}
        <div className="m-brand-row">
          <img src="/brand/maka-logo.svg" alt="Maka" width={36} height={36} style={{ display: 'block', flexShrink: 0 }} />
          <h1>Maka</h1>
        </div>
        <p className="m-landing-quote">"มาค่ะ"</p>
        <p className="m-landing-desc">App เช็คชื่อเข้าเรียนด้วยใบหน้า</p>

        {/* Role selection */}
        <p className="m-role-hint">เลือกบทบาทเพื่อเริ่มต้น</p>
        <div className="m-role-buttons">
          <button className="m-btn m-btn-salmon" onClick={() => enterSignIn('student')}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            ฉันเป็นนักศึกษา
          </button>
          <button className="m-btn m-btn-white" onClick={() => enterSignIn('teacher')}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            ฉันเป็นอาจารย์
          </button>
        </div>

        {/* Safety chip */}
        <div className="m-safety-chip">
          <div className="m-safety-icon">🛡️</div>
          <span>ปลอดภัยด้วยการตรวจ liveness ป้องกันการใช้รูปแทนตัวจริง</span>
        </div>

        {/* Registration links */}
        <div className="m-divider-text">ยังไม่มีบัญชี?</div>
        <div className="m-two-col">
          <Link
            href="/auth/register/student"
            className="m-btn m-btn-outline m-btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1.5px solid var(--accent)', borderRadius: 14, fontFamily: '"Mitr",sans-serif', fontSize: 14 }}
          >
            ลงทะเบียนนักศึกษา
          </Link>
          <Link
            href="/auth/register/teacher"
            className="m-btn m-btn-white m-btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', borderRadius: 14, fontFamily: '"Mitr",sans-serif', fontSize: 14 }}
          >
            ลงทะเบียนอาจารย์
          </Link>
        </div>

        {/* Footer */}
        <p style={{ margin: '20px 0 4px', fontSize: 11, color: 'var(--soft)', textAlign: 'center' }}>
          © 2026 Pattaraporn Warintarawej
        </p>
        <p style={{ margin: 0, textAlign: 'center' }}>
          <Link href="/about" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', opacity: 0.8 }}>
            เกี่ยวกับ Maka App ›
          </Link>
        </p>
      </div>
    </div>
  )
}

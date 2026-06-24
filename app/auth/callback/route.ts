import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const url    = new URL(request.url)
  const code   = url.searchParams.get('code')
  const origin = url.origin

  if (!code) {
    return NextResponse.redirect(new URL('/auth?error=no_code', origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/auth?error=oauth_failed', origin))
  }

  // ดึง user หลัง exchange session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth', origin))
  }

  // สร้าง profile ถ้ายังไม่มี (new Google user → default student)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!existing) {
    const displayName = user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? (user.email?.split('@')[0] ?? 'ผู้ใช้งาน')

    await supabase.from('profiles').insert({
      id:        user.id,
      role:      'student',
      full_name: displayName,
      email:     user.email ?? '',
    })
  }

  // Redirect ตาม role
  const role = existing?.role ?? 'student'
  const dest = (role === 'teacher' || role === 'admin') ? '/teacher' : '/student'
  return NextResponse.redirect(new URL(dest, origin))
}

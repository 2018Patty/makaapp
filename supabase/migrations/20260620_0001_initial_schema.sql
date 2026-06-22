create extension if not exists "pgcrypto";
create extension if not exists vector;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('student', 'teacher', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('on-time', 'late', 'absent');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('open', 'closed');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text not null,
  student_id text unique,
  faculty text,
  email text unique not null,
  avatar_url text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  room text,
  instructor_id uuid references public.profiles(id) on delete set null,
  instructor_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_members (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, profile_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  late_threshold_minutes integer not null default 15,
  status public.session_status not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.face_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  embedding vector(512) not null,
  quality_score numeric(5, 2),
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null,
  checked_at timestamptz not null default now(),
  method text not null default 'face',
  similarity numeric(5, 4),
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, profile_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'student',
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists set_sessions_updated_at on public.sessions;
create trigger set_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_face_templates_updated_at on public.face_templates;
create trigger set_face_templates_updated_at
before update on public.face_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_attendance_updated_at on public.attendance;
create trigger set_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_members enable row level security;
alter table public.sessions enable row level security;
alter table public.face_templates enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_own_read" on public.profiles;
create policy "profiles_own_read"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_own_write" on public.profiles;
create policy "profiles_own_write"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_own_insert" on public.profiles;
create policy "profiles_own_insert"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "courses_authenticated_read" on public.courses;
create policy "courses_authenticated_read"
on public.courses
for select
to authenticated
using (true);

drop policy if exists "course_members_own_read" on public.course_members;
create policy "course_members_own_read"
on public.course_members
for select
using (auth.uid() = profile_id);

drop policy if exists "sessions_authenticated_read" on public.sessions;
create policy "sessions_authenticated_read"
on public.sessions
for select
to authenticated
using (true);

drop policy if exists "face_templates_own_read" on public.face_templates;
create policy "face_templates_own_read"
on public.face_templates
for select
using (auth.uid() = profile_id);

drop policy if exists "face_templates_own_write" on public.face_templates;
create policy "face_templates_own_write"
on public.face_templates
for insert
with check (auth.uid() = profile_id);

drop policy if exists "attendance_own_read" on public.attendance;
create policy "attendance_own_read"
on public.attendance
for select
using (auth.uid() = profile_id);

drop policy if exists "attendance_own_write" on public.attendance;
create policy "attendance_own_write"
on public.attendance
for insert
with check (auth.uid() = profile_id);

drop policy if exists "audit_logs_authenticated_read" on public.audit_logs;
create policy "audit_logs_authenticated_read"
on public.audit_logs
for select
to authenticated
using (true);

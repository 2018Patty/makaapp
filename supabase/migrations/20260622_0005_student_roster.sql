-- ============================================================
-- Student roster — pre-populated class list (from Excel upload)
-- Allows teacher to track all students even before they register
-- ============================================================

create table if not exists public.student_roster (
  id          uuid    primary key default gen_random_uuid(),
  course_id   uuid    not null references public.courses(id) on delete cascade,
  student_id  text    not null,
  full_name   text    not null,
  profile_id  uuid    references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (course_id, student_id)
);

alter table public.student_roster enable row level security;

-- Teachers manage roster for their own courses
drop policy if exists "roster_teacher_manage" on public.student_roster;
create policy "roster_teacher_manage"
  on public.student_roster for all
  using (
    exists (
      select 1 from public.courses c
      where c.id = student_roster.course_id
        and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = student_roster.course_id
        and c.instructor_id = auth.uid()
    )
  );

-- Students can read their own roster entries
drop policy if exists "roster_student_read" on public.student_roster;
create policy "roster_student_read"
  on public.student_roster for select
  using (profile_id = auth.uid());

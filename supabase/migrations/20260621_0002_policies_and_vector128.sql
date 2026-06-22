-- ============================================================
-- 1. Resize face embedding from vector(512) → vector(128)
--    face-api.js / @vladmandic/face-api produces 128-dim descriptors
-- ============================================================

truncate public.face_templates;   -- seed data used 512-dim, safe to clear

alter table public.face_templates
  alter column embedding type vector(128);


-- ============================================================
-- 2. Teacher RLS policies
--    Default policies only let users read their own rows.
--    Teachers need to read/write attendance, profiles, and
--    manage sessions for courses they own.
-- ============================================================

-- Teachers can read all profiles of students enrolled in their courses
-- (needed for the live attendance list)
drop policy if exists "profiles_teacher_read" on public.profiles;
create policy "profiles_teacher_read"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.course_members cm
      join public.courses c on c.id = cm.course_id
      where cm.profile_id = public.profiles.id
        and c.instructor_id = auth.uid()
    )
  );

-- Teachers can read course_members for their own courses
drop policy if exists "course_members_teacher_read" on public.course_members;
create policy "course_members_teacher_read"
  on public.course_members for select
  using (
    auth.uid() = profile_id
    or exists (
      select 1 from public.courses c
      where c.id = course_members.course_id
        and c.instructor_id = auth.uid()
    )
  );

-- Teachers can create / update / delete courses they own
drop policy if exists "courses_teacher_write" on public.courses;
create policy "courses_teacher_write"
  on public.courses for all
  using  (instructor_id = auth.uid())
  with check (instructor_id = auth.uid());

-- Teachers can manage sessions for their courses (open / close)
drop policy if exists "sessions_teacher_write" on public.sessions;
create policy "sessions_teacher_write"
  on public.sessions for all
  using (
    exists (
      select 1 from public.courses c
      where c.id = sessions.course_id
        and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = sessions.course_id
        and c.instructor_id = auth.uid()
    )
  );

-- Teachers can read attendance for sessions in their courses
drop policy if exists "attendance_teacher_read" on public.attendance;
create policy "attendance_teacher_read"
  on public.attendance for select
  using (
    auth.uid() = profile_id
    or exists (
      select 1 from public.sessions s
      join public.courses c on c.id = s.course_id
      where s.id = attendance.session_id
        and c.instructor_id = auth.uid()
    )
  );

-- Teachers can manually insert/update attendance for their sessions
drop policy if exists "attendance_teacher_write" on public.attendance;
create policy "attendance_teacher_write"
  on public.attendance for insert
  with check (
    exists (
      select 1 from public.sessions s
      join public.courses c on c.id = s.course_id
      where s.id = attendance.session_id
        and c.instructor_id = auth.uid()
    )
  );

drop policy if exists "attendance_teacher_update" on public.attendance;
create policy "attendance_teacher_update"
  on public.attendance for update
  using (
    exists (
      select 1 from public.sessions s
      join public.courses c on c.id = s.course_id
      where s.id = attendance.session_id
        and c.instructor_id = auth.uid()
    )
  );


-- ============================================================
-- 3. Update seed.sql-style data to use vector(128)
--    (Run seed.sql again after applying this migration)
-- ============================================================

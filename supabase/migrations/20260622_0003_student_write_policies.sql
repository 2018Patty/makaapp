-- ============================================================
-- Student write policies (previously missing)
-- ============================================================

-- Students can join courses (insert own membership row)
drop policy if exists "course_members_own_insert" on public.course_members;
create policy "course_members_own_insert"
  on public.course_members for insert
  with check (auth.uid() = profile_id);

-- Students can deactivate their old face templates before enrolling a new one
drop policy if exists "face_templates_own_update" on public.face_templates;
create policy "face_templates_own_update"
  on public.face_templates for update
  using  (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

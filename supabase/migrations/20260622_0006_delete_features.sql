-- ============================================================
-- Delete features
-- 1. attendance.profile_id → SET NULL on profile delete
--    (keep attendance rows even when student account is removed)
-- 2. delete_own_account() RPC — student deletes own auth account
-- ============================================================

-- Re-create FK with SET NULL so attendance rows survive profile deletion
alter table public.attendance
  drop constraint if exists attendance_profile_id_fkey;

alter table public.attendance
  add constraint attendance_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- RPC: student deletes their own account
-- SECURITY DEFINER runs as function owner (can access auth.users)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove face templates
  delete from public.face_templates  where profile_id = auth.uid();
  -- Remove course memberships
  delete from public.course_members  where profile_id = auth.uid();
  -- Unlink from roster rows (keeps roster entry, just clears profile link)
  update public.student_roster set profile_id = null where profile_id = auth.uid();
  -- Delete profile (attendance rows get profile_id → null via SET NULL FK)
  delete from public.profiles        where id = auth.uid();
  -- Delete auth user
  delete from auth.users             where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

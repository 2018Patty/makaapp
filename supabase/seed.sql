-- ============================================================
-- Maka App — Seed / Setup Script (Hosted Supabase)
--
-- วิธีใช้:
--   1. สมัครบัญชีผ่านหน้า /auth ของแอปก่อน (อย่างน้อย 1 teacher + 1 student)
--   2. แก้ไขค่า email ด้านล่างให้ตรงกับที่สมัครไว้
--   3. รัน SQL นี้ใน Supabase SQL Editor
-- ============================================================

do $$
declare
  v_teacher_id  uuid;
  v_student1_id uuid;
  v_student2_id uuid;
  v_student3_id uuid;
  v_course1_id  uuid;
  v_course2_id  uuid;
  v_course3_id  uuid;

  -- ✏️  แก้ email ให้ตรงกับที่สมัครไว้ในแอป
  c_teacher_email  constant text := 'pattaraporn.w@psu.ac.th';
  c_student1_email constant text := 'student1@example.com';
  c_student2_email constant text := 'student2@example.com';
  c_student3_email constant text := 'student3@example.com';
begin

  -- ── 1. หา UUID จาก auth.users ───────────────────────────
  select id into v_teacher_id  from auth.users where email = c_teacher_email;
  select id into v_student1_id from auth.users where email = c_student1_email;
  select id into v_student2_id from auth.users where email = c_student2_email;
  select id into v_student3_id from auth.users where email = c_student3_email;

  if v_teacher_id is null then
    raise exception
      'ไม่พบ email: % — กรุณาสมัครบัญชีผ่านหน้า /auth ก่อน', c_teacher_email;
  end if;

  -- ── 2. ตั้งค่า role อาจารย์ ──────────────────────────────
  update public.profiles
  set role      = 'teacher',
      full_name = coalesce(nullif(trim(full_name), ''), 'อาจารย์'),
      updated_at = now()
  where id = v_teacher_id;

  -- ── 3. สร้างรายวิชา ──────────────────────────────────────
  insert into public.courses (code, name, room, instructor_id, instructor_name)
  values
    ('WEB301', 'การเขียนโปรแกรมเว็บ',      'IT-302', v_teacher_id, 'อาจารย์'),
    ('DB201',  'ฐานข้อมูลเบื้องต้น',       'IT-210', v_teacher_id, 'อาจารย์'),
    ('ENG105', 'ภาษาอังกฤษเพื่อการสื่อสาร','LA-105', v_teacher_id, 'อาจารย์')
  on conflict (code) do update
    set instructor_id   = excluded.instructor_id,
        instructor_name = excluded.instructor_name,
        updated_at      = now();

  -- ดึง ID ของแต่ละวิชา
  select id into v_course1_id from public.courses where code = 'WEB301';
  select id into v_course2_id from public.courses where code = 'DB201';
  select id into v_course3_id from public.courses where code = 'ENG105';

  -- ── 4. เพิ่มนักศึกษาเข้าวิชา (ถ้าสมัครไว้) ──────────────
  if v_student1_id is not null then
    update public.profiles
    set role = 'student', updated_at = now()
    where id = v_student1_id;

    insert into public.course_members (course_id, profile_id)
    values (v_course1_id, v_student1_id)
    on conflict do nothing;
  end if;

  if v_student2_id is not null then
    update public.profiles
    set role = 'student', updated_at = now()
    where id = v_student2_id;

    insert into public.course_members (course_id, profile_id)
    values (v_course1_id, v_student2_id)
    on conflict do nothing;
  end if;

  if v_student3_id is not null then
    update public.profiles
    set role = 'student', updated_at = now()
    where id = v_student3_id;

    insert into public.course_members (course_id, profile_id)
    values (v_course1_id, v_student3_id)
    on conflict do nothing;
  end if;

  -- ── 5. บันทึก audit log ──────────────────────────────────
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values
    (v_teacher_id, 'seed:setup', 'courses', v_course1_id, '{"source":"seed"}')
  on conflict do nothing;

  raise notice 'Setup เสร็จสิ้น — teacher: %', v_teacher_id;
  if v_student1_id is not null then raise notice 'student1: %', v_student1_id; end if;
  if v_student2_id is not null then raise notice 'student2: %', v_student2_id; end if;
  if v_student3_id is not null then raise notice 'student3: %', v_student3_id; end if;

end $$;

-- ============================================================
-- Add join_code (was added manually to DB earlier — safe if exists)
-- and schedule / academic-term fields to courses
-- ============================================================

alter table public.courses
  add column if not exists join_code            text unique,
  add column if not exists academic_year        text,
  add column if not exists semester             smallint check (semester between 1 and 3),
  add column if not exists schedule_days        text[]  not null default '{}',
  add column if not exists schedule_start_time  time,
  add column if not exists schedule_end_time    time,
  add column if not exists late_threshold_minutes integer not null default 15;

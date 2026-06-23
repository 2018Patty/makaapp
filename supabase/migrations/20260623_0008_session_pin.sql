-- Add session PIN for alternative check-in (no camera required)
alter table public.sessions
  add column if not exists session_pin varchar(4);

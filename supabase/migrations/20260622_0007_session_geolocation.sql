-- Add geolocation to sessions
-- Teacher's GPS is captured when opening a session.
-- Student's GPS is verified at check-in time (client-side distance check).

alter table public.sessions
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

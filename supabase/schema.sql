-- The Mat Pilates Club: booking schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- Classes on the timetable -------------------------------------------------
create table if not exists public.classes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default 'Mat Pilates',
  level        text not null default 'All levels',
  starts_at    timestamptz not null,
  duration_min int  not null default 60,
  location     text not null,
  capacity     int  not null default 12 check (capacity > 0),
  created_at   timestamptz not null default now()
);

create index if not exists classes_starts_at_idx on public.classes (starts_at);

-- Bookings (private: never readable from the website) ----------------------
create table if not exists public.bookings (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  name       text not null,
  email      text not null,
  phone      text,
  pass_type  text not null check (pass_type in ('trial-4', 'pack-8', 'drop-in')),
  created_at timestamptz not null default now(),
  unique (class_id, email)
);

alter table public.classes  enable row level security;
alter table public.bookings enable row level security;

-- Anyone can see the timetable; nobody can read or write bookings directly.
drop policy if exists "Public can view classes" on public.classes;
create policy "Public can view classes" on public.classes
  for select using (true);

-- Timetable with live availability (exposes counts only, never names/emails)
create or replace view public.class_schedule as
select
  c.id, c.title, c.level, c.starts_at, c.duration_min, c.location, c.capacity,
  c.capacity - count(b.id)::int as spots_left
from public.classes c
left join public.bookings b on b.class_id = c.id
group by c.id;

grant select on public.class_schedule to anon, authenticated;

-- Book a space: checks capacity atomically so classes can't be overbooked.
create or replace function public.book_class(
  p_class_id  uuid,
  p_name      text,
  p_email     text,
  p_phone     text,
  p_pass_type text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class   public.classes;
  v_taken   int;
  v_booking uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'This class no longer exists.';
  end if;
  if v_class.starts_at < now() then
    raise exception 'This class has already started.';
  end if;

  select count(*) into v_taken from public.bookings where class_id = p_class_id;
  if v_taken >= v_class.capacity then
    raise exception 'Sorry, this class is now full.';
  end if;

  insert into public.bookings (class_id, name, email, phone, pass_type)
  values (p_class_id, trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), p_pass_type)
  returning id into v_booking;

  return v_booking;
exception
  when unique_violation then
    raise exception 'You''re already booked into this class.';
end;
$$;

grant execute on function public.book_class(uuid, text, text, text, text) to anon, authenticated;

-- Example: add a class (edit and run whenever you schedule one) -------------
-- insert into public.classes (title, level, starts_at, location, capacity)
-- values ('Mat Pilates', 'All levels', '2026-10-12 19:00:00+01', 'Venue name', 12);

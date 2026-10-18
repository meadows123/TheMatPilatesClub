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
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes (id) on delete cascade,
  name          text not null,
  email         text not null,
  phone         text,
  pass_type     text not null check (pass_type in ('intro-4', 'pack-8', 'private-intro', 'existing')),
  discount_code text,
  created_at    timestamptz not null default now(),
  unique (class_id, email)
);

-- Waiting list for full classes (private) -----------------------------------
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  name       text not null,
  email      text not null,
  phone      text,
  created_at timestamptz not null default now(),
  unique (class_id, email)
);

alter table public.classes  enable row level security;
alter table public.bookings enable row level security;
alter table public.waitlist enable row level security;

-- Anyone can see the timetable; nobody can read or write bookings/waitlist directly.
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
  p_class_id      uuid,
  p_name          text,
  p_email         text,
  p_phone         text,
  p_pass_type     text,
  p_discount_code text default null
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
    raise exception 'Sorry, this class is now full. You can join the waiting list instead.';
  end if;

  insert into public.bookings (class_id, name, email, phone, pass_type, discount_code)
  values (p_class_id, trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), p_pass_type,
          nullif(upper(trim(p_discount_code)), ''))
  returning id into v_booking;

  -- If they were on this class's waiting list, take them off it
  delete from public.waitlist where class_id = p_class_id and email = lower(trim(p_email));

  return v_booking;
exception
  when unique_violation then
    raise exception 'You''re already booked into this class.';
end;
$$;

-- Join the waiting list for a class.
create or replace function public.join_waitlist(
  p_class_id uuid,
  p_name     text,
  p_email    text,
  p_phone    text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry uuid;
begin
  if not exists (select 1 from public.classes where id = p_class_id and starts_at > now()) then
    raise exception 'This class is no longer available.';
  end if;
  if exists (select 1 from public.bookings where class_id = p_class_id and email = lower(trim(p_email))) then
    raise exception 'You''re already booked into this class.';
  end if;

  insert into public.waitlist (class_id, name, email, phone)
  values (p_class_id, trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''))
  returning id into v_entry;

  return v_entry;
exception
  when unique_violation then
    raise exception 'You''re already on the waiting list for this class.';
end;
$$;

grant execute on function public.book_class(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.join_waitlist(uuid, text, text, text) to anon, authenticated;

-- Handy queries for the instructor (run in the SQL Editor) -------------------
-- Add a class:
--   insert into public.classes (title, level, starts_at, location, capacity)
--   values ('Mat Pilates', 'All levels', '2026-10-13 19:30:00+01', 'The Manor Hall, Coalpit Heath', 12);
--
-- Who's booked / waiting for upcoming classes:
--   select c.starts_at, b.name, b.email, b.pass_type, b.discount_code
--   from bookings b join classes c on c.id = b.class_id where c.starts_at > now() order by c.starts_at;
--   select c.starts_at, w.name, w.email, w.created_at
--   from waitlist w join classes c on c.id = w.class_id where c.starts_at > now() order by c.starts_at, w.created_at;

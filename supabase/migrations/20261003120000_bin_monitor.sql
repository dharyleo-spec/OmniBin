-- Live trashcan monitor for OmniBin.
-- The distance sensor and ESP32-CAM write here directly.
-- The app reads these tables. No separate web server is required.
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device text not null default 'trash-bin',
  distance_cm numeric,
  fill_percent numeric not null,
  is_full boolean not null default false
);

create index if not exists readings_created_at_idx
  on public.readings (created_at desc);

-- The HC-SR04 sketch posts distance_cm only.
-- Fill and the full flag are calculated here: 40 cm bin, full at 85%.
create or replace function public.prepare_reading()
returns trigger
language plpgsql
as $$
declare
  bin_height numeric := 40;
  full_at numeric := 85;
begin
  if new.distance_cm is not null then
    new.distance_cm := round(greatest(new.distance_cm, 0), 1);
    new.fill_percent := round(
      (1 - least(new.distance_cm, bin_height) / bin_height) * 100,
      1
    );
  end if;

  if new.fill_percent is null then
    raise exception 'Send distance_cm or fill_percent.';
  end if;

  new.fill_percent := least(100, greatest(0, round(new.fill_percent, 1)));
  new.is_full := new.fill_percent >= full_at;
  return new;
end;
$$;

drop trigger if exists readings_prepare on public.readings;
create trigger readings_prepare
  before insert on public.readings
  for each row
  execute function public.prepare_reading();

create table if not exists public.camera_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device text not null default 'esp32-cam',
  is_full boolean,
  filename text,
  image_url text
);

create index if not exists camera_checks_created_at_idx
  on public.camera_checks (created_at desc);

alter table public.readings enable row level security;
alter table public.camera_checks enable row level security;

drop policy if exists "Public read readings" on public.readings;
create policy "Public read readings"
  on public.readings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Devices insert readings" on public.readings;
create policy "Devices insert readings"
  on public.readings
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public read camera checks" on public.camera_checks;
create policy "Public read camera checks"
  on public.camera_checks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Devices insert camera checks" on public.camera_checks;
create policy "Devices insert camera checks"
  on public.camera_checks
  for insert
  to anon, authenticated
  with check (true);

insert into storage.buckets (id, name, public)
values ('trash-photos', 'trash-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Upload trash photos" on storage.objects;
drop policy if exists "Update trash photos" on storage.objects;
drop policy if exists "Read trash photos" on storage.objects;

create policy "Upload trash photos"
  on storage.objects
  for insert
  to anon, authenticated, service_role
  with check (bucket_id = 'trash-photos');

create policy "Update trash photos"
  on storage.objects
  for update
  to anon, authenticated, service_role
  using (bucket_id = 'trash-photos')
  with check (bucket_id = 'trash-photos');

create policy "Read trash photos"
  on storage.objects
  for select
  to anon, authenticated, service_role, public
  using (bucket_id = 'trash-photos');

do $$
begin
  alter publication supabase_realtime add table public.readings;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.camera_checks;
exception
  when duplicate_object then null;
end $$;

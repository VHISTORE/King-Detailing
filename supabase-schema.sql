-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- ========== Tables ==========

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  title text,
  created_at timestamptz default now()
);

-- multi-photo support
alter table public.gallery add column if not exists images jsonb not null default '[]';
update public.gallery
set images = jsonb_build_array(jsonb_build_object('url', image_url, 'path', storage_path))
where jsonb_array_length(images) = 0 and image_url is not null;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 60),
  car  text check (char_length(car) <= 60),
  text text not null check (char_length(text) <= 600),
  approved boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price text,
  tag text,
  features text[] default '{}',
  featured boolean default false,
  order_idx int default 0,
  created_at timestamptz default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  status text not null default 'new',
  created_at timestamptz default now()
);

-- ========== Helper: who is admin ==========
-- Hardcoded admin email: vibemusic1712@gmail.com
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'email') in ('vibemusic1712@gmail.com', 'bulgakovakeksandr939@gmail.com'),
    false
  );
$$;

-- ========== Row Level Security ==========

alter table public.gallery  enable row level security;
alter table public.comments enable row level security;
alter table public.services enable row level security;
alter table public.requests enable row level security;

-- Drop old policies if rerunning
drop policy if exists "gallery read"   on public.gallery;
drop policy if exists "gallery write"  on public.gallery;
drop policy if exists "services read"  on public.services;
drop policy if exists "services write" on public.services;
drop policy if exists "comments read public"  on public.comments;
drop policy if exists "comments read admin"   on public.comments;
drop policy if exists "comments insert"       on public.comments;
drop policy if exists "comments admin write"  on public.comments;
drop policy if exists "requests insert"       on public.requests;
drop policy if exists "requests admin"        on public.requests;

-- Gallery: public read, admin-only write
create policy "gallery read"  on public.gallery for select using (true);
create policy "gallery write" on public.gallery for all
  using (public.is_admin()) with check (public.is_admin());

-- Services: public read, admin-only write
create policy "services read"  on public.services for select using (true);
create policy "services write" on public.services for all
  using (public.is_admin()) with check (public.is_admin());

-- Comments
create policy "comments read public" on public.comments for select using (approved = true);
create policy "comments read admin"  on public.comments for select using (public.is_admin());
create policy "comments insert"      on public.comments for insert
  with check (approved = false); -- visitors can only insert pending comments
create policy "comments admin write" on public.comments for update using (public.is_admin()) with check (public.is_admin());
create policy "comments admin delete" on public.comments for delete using (public.is_admin());

-- Requests: anyone can submit, only admin can read/edit/delete
create policy "requests insert" on public.requests for insert with check (status = 'new');
create policy "requests admin"  on public.requests for all using (public.is_admin()) with check (public.is_admin());

-- ========== Storage bucket ==========
-- Create the bucket via Dashboard → Storage → New bucket → name: gallery, public: ON
-- Then run the policies below:

drop policy if exists "gallery storage read"   on storage.objects;
drop policy if exists "gallery storage write"  on storage.objects;
drop policy if exists "gallery storage update" on storage.objects;
drop policy if exists "gallery storage delete" on storage.objects;

create policy "gallery storage read"  on storage.objects for select
  using (bucket_id = 'gallery');
create policy "gallery storage write" on storage.objects for insert
  with check (bucket_id = 'gallery' and public.is_admin());
create policy "gallery storage update" on storage.objects for update
  using (bucket_id = 'gallery' and public.is_admin());
create policy "gallery storage delete" on storage.objects for delete
  using (bucket_id = 'gallery' and public.is_admin());

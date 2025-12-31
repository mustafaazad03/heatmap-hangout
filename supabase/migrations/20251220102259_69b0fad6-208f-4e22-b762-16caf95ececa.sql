-- Profiles table for named users
create table if not exists public.profiles (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null unique,
  display_name text,
  avatar_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = user_id);

-- Streaks table for daily visit streak tracking
create table if not exists public.streaks (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  current_streak integer not null default 0,
  max_streak integer not null default 0,
  last_visit date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.streaks enable row level security;

create policy "Users can manage their own streaks"
  on public.streaks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared updated_at trigger function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

create trigger set_streaks_updated_at
before update on public.streaks
for each row execute function public.update_updated_at_column();

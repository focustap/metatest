create table if not exists public.spotify_now_playing (
  id text primary key default 'main',
  title text,
  artist text,
  album text,
  cover_url text,
  external_url text,
  progress_ms integer not null default 0,
  duration_ms integer not null default 1,
  is_playing boolean not null default false,
  source text not null default 'spotify',
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.spotify_now_playing (
  id,
  title,
  artist,
  album,
  progress_ms,
  duration_ms,
  is_playing,
  fetched_at,
  updated_at
)
values (
  'main',
  'Spotify standby',
  'Waiting for Edge Function',
  '',
  0,
  1,
  false,
  now(),
  now()
)
on conflict (id) do nothing;

alter table public.spotify_now_playing enable row level security;

drop policy if exists "Public can read now playing" on public.spotify_now_playing;
create policy "Public can read now playing"
on public.spotify_now_playing
for select
to anon
using (id = 'main');

grant usage on schema public to anon;
grant select on public.spotify_now_playing to anon;

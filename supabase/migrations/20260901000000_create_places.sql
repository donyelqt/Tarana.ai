-- Migration: places world cache (Gala PH->World scale, Slice 4)
-- Creates world POI cache + backfills 38 curated Baguio places to avoid Tier-1 cost on first 24h
create extension if not exists "vector";

create table if not exists public.places (
  id text primary key,
  city_id text not null,
  title text not null,
  lat double precision not null,
  lon double precision not null,
  category text,
  source text not null check (source in ('curated','tomtom','google')),
  image_url text,
  metadata jsonb,
  embedding vector(768),
  valid_until timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists places_embedding_idx on public.places using ivfflat (embedding vector_cosine_ops) with (lists = 100) where embedding is not null;
create index if not exists places_city_title_idx on public.places (city_id, title);
create index if not exists places_valid_until_idx on public.places (valid_until) where valid_until is not null;

-- Backfill 38 curated Baguio places (ON CONFLICT skips if already present)
insert into public.places (id, city_id, title, lat, lon, category, source, metadata, created_at)
values
  ('baguio:Burnham Park', 'baguio', 'Burnham Park', 16.4093, 120.595, 'park', 'curated', '{}'::jsonb, now()),
  ('baguio:Mines View Park', 'baguio', 'Mines View Park', 16.4013, 120.6003, 'viewpoint', 'curated', '{}'::jsonb, now()),
  ('baguio:Baguio Cathedral', 'baguio', 'Baguio Cathedral', 16.4075, 120.5923, 'religious', 'curated', '{}'::jsonb, now()),
  ('baguio:Botanical Garden', 'baguio', 'Botanical Garden', 16.4141, 120.6132, 'nature', 'curated', '{}'::jsonb, now()),
  ('baguio:The Mansion', 'baguio', 'The Mansion', 16.4124, 120.6215, 'historical', 'curated', '{}'::jsonb, now()),
  ('baguio:Wright Park', 'baguio', 'Wright Park', 16.4151, 120.6186, 'park', 'curated', '{}'::jsonb, now()),
  ('baguio:Camp John Hay', 'baguio', 'Camp John Hay', 16.3994, 120.6157, 'recreational', 'curated', '{}'::jsonb, now()),
  ('baguio:Bencab Museum', 'baguio', 'Bencab Museum', 16.3805, 120.6259, 'museum', 'curated', '{}'::jsonb, now()),
  ('baguio:Tam-Awan Village', 'baguio', 'Tam-Awan Village', 16.43, 120.5769, 'cultural', 'curated', '{}'::jsonb, now()),
  ('baguio:Baguio Night Market', 'baguio', 'Baguio Night Market', 16.4121, 120.5961, 'market', 'curated', '{}'::jsonb, now()),
  ('baguio:SM City Baguio', 'baguio', 'SM City Baguio', 16.4092, 120.5998, 'mall', 'curated', '{}'::jsonb, now()),
  ('baguio:Baguio Public Market', 'baguio', 'Baguio Public Market', 16.4153, 120.5957, 'market', 'curated', '{}'::jsonb, now()),
  ('baguio:Good Shepherd Convent', 'baguio', 'Good Shepherd Convent', 16.4063, 120.6025, 'religious', 'curated', '{}'::jsonb, now()),
  ('baguio:Mirador Heritage and Eco Park', 'baguio', 'Mirador Heritage and Eco Park', 16.4089, 120.5812, 'nature', 'curated', '{}'::jsonb, now()),
  ('baguio:Diplomat Hotel', 'baguio', 'Diplomat Hotel', 16.4059, 120.5851, 'historical', 'curated', '{}'::jsonb, now()),
  ('baguio:Lions Head', 'baguio', 'Lions Head', 16.3603, 120.6128, 'viewpoint', 'curated', '{}'::jsonb, now()),
  ('baguio:Ili-Likha Artists Village', 'baguio', 'Ili-Likha Artists Village', 16.4138, 120.5974, 'cultural', 'curated', '{}'::jsonb, now()),
  ('baguio:Philippine Military Academy', 'baguio', 'Philippine Military Academy', 16.3609, 120.6197, 'educational', 'curated', '{}'::jsonb, now()),
  ('baguio:Great wall of Baguio', 'baguio', 'Great wall of Baguio', 16.3698, 120.6116, 'viewpoint', 'curated', '{}'::jsonb, now()),
  ('baguio:Camp John Hay Yellow Trail', 'baguio', 'Camp John Hay Yellow Trail', 16.3994, 120.6157, 'trail', 'curated', '{}'::jsonb, now()),
  ('baguio:Valley of Colors', 'baguio', 'Valley of Colors', 16.4583, 120.5908, 'cultural', 'curated', '{}'::jsonb, now()),
  ('baguio:Easter Weaving Room', 'baguio', 'Easter Weaving Room', 16.4226, 120.5901, 'cultural', 'curated', '{}'::jsonb, now()),
  ('baguio:Mt. Kalugong', 'baguio', 'Mt. Kalugong', 16.4603, 120.5956, 'mountain', 'curated', '{}'::jsonb, now()),
  ('baguio:Chimichanga by Jaimes Family Feast', 'baguio', 'Chimichanga by Jaimes Family Feast', 16.4083, 120.5931, 'restaurant', 'curated', '{}'::jsonb, now()),
  ('baguio:Kapi Kullaaw', 'baguio', 'Kapi Kullaaw', 16.4138, 120.5973, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:Itaewon Cafe', 'baguio', 'Itaewon Cafe', 16.414, 120.5951, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:Agara Ramen', 'baguio', 'Agara Ramen', 16.409, 120.602, 'restaurant', 'curated', '{}'::jsonb, now()),
  ('baguio:KoCo Cafe', 'baguio', 'KoCo Cafe', 16.4083, 120.5944, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:Good Sheperd Cafe', 'baguio', 'Good Sheperd Cafe', 16.4063, 120.6025, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:Tavern Cafe', 'baguio', 'Tavern Cafe', 16.3799, 120.6173, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:Oh My Gulay', 'baguio', 'Oh My Gulay', 16.4118, 120.5981, 'restaurant', 'curated', '{}'::jsonb, now()),
  ('baguio:Hill Station', 'baguio', 'Hill Station', 16.4096, 120.6006, 'restaurant', 'curated', '{}'::jsonb, now()),
  ('baguio:Hiraya Cafe', 'baguio', 'Hiraya Cafe', 16.4096, 120.6006, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:Uji-Matcha Cafe', 'baguio', 'Uji-Matcha Cafe', 16.416, 120.596, 'cafe', 'curated', '{}'::jsonb, now()),
  ('baguio:K-Flavors Buffet', 'baguio', 'K-Flavors Buffet', 16.407, 120.5923, 'restaurant', 'curated', '{}'::jsonb, now()),
  ('baguio:Korean Palace Kung Jeon', 'baguio', 'Korean Palace Kung Jeon', 16.4077, 120.6086, 'restaurant', 'curated', '{}'::jsonb, now()),
  ('baguio:Myeong Dong Jjigae Restaurant', 'baguio', 'Myeong Dong Jjigae Restaurant', 16.4027, 120.5923, 'restaurant', 'curated', '{}'::jsonb, now())
on conflict (id) do nothing;

-- Nightly prune is external cron: delete from places where valid_until < now();

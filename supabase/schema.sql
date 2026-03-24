-- Supabase SQL Editor에 붙여넣고 실행하세요
-- https://supabase.com/dashboard/project/_/sql

create table if not exists policy_updates (
  id          uuid        default gen_random_uuid() primary key,
  title       text        not null,
  platform    text        not null,
  date        text        not null,
  summary     text        not null,
  severity    text        not null check (severity in ('high', 'medium', 'low')),
  countries   text[]      not null default '{}',
  source_url  text,
  raw_title   text,
  created_at  timestamptz default now()
);

-- 중복 수집 방지: 같은 source_url은 한 번만 저장
create unique index if not exists policy_updates_source_url_idx
  on policy_updates (source_url)
  where source_url is not null;

-- 누구나 읽기 가능 (포트폴리오용)
alter table policy_updates enable row level security;
create policy "Public read"   on policy_updates for select using (true);
create policy "Service write" on policy_updates for insert with check (true);

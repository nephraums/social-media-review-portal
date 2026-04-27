-- Social Media Review Portal schema
-- Run in Supabase SQL Editor after creating a new Supabase project.
-- This is designed for a multi-tenant SaaS prototype, even if you start with one club.

create extension if not exists pgcrypto;

-- ---------- Types ----------

do $$
begin
  create type public.org_role as enum ('owner', 'admin', 'reviewer');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.submission_status as enum (
    'received',
    'drafting',
    'pending_review',
    'approved',
    'rejected',
    'publishing',
    'published',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.publish_job_status as enum (
    'queued',
    'running',
    'succeeded',
    'failed'
  );
exception when duplicate_object then null;
end $$;

-- ---------- Core tenant tables ----------

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  whatsapp_number text,
  instagram_username text,
  subscription_status text not null default 'prototype',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_role not null default 'reviewer',
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

-- WhatsApp submitters are not necessarily app users.
create table if not exists public.submitters (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  whatsapp_from text not null,
  display_name text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, whatsapp_from)
);

-- ---------- Review workflow ----------

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  submitter_id uuid references public.submitters(id) on delete set null,
  whatsapp_from text,
  source text not null default 'whatsapp',
  brief text not null,
  status public.submission_status not null default 'received',
  media_urls jsonb,
  media_paths jsonb,
  draft_caption text,
  final_caption text,
  ai_model text,
  ai_error text,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  instagram_media_id text,
  instagram_permalink text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_org_status_created_idx
  on public.submissions (organisation_id, status, created_at desc);

create index if not exists submissions_org_created_idx
  on public.submissions (organisation_id, created_at desc);

create table if not exists public.submission_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  event_type text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists submission_events_submission_created_idx
  on public.submission_events (submission_id, created_at desc);

-- ---------- Gemini style learning ----------

create table if not exists public.style_examples (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  label text,
  post_text text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists style_examples_org_created_idx
  on public.style_examples (organisation_id, created_at desc);

create table if not exists public.organisation_ai_settings (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  brand_voice_notes text,
  default_hashtags text,
  banned_phrases text,
  call_to_action_notes text,
  auto_draft boolean not null default true,
  gemini_model text not null default 'gemini-2.0-flash',
  updated_at timestamptz not null default now()
);

-- ---------- Instagram publishing ----------

create table if not exists public.instagram_connections (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  instagram_user_id text not null,
  instagram_username text,
  facebook_page_id text,
  access_token text not null,
  token_expires_at timestamptz,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  status public.publish_job_status not null default 'queued',
  platform text not null default 'instagram',
  attempt_count integer not null default 0,
  last_error text,
  external_container_id text,
  external_media_id text,
  external_permalink text,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists publish_jobs_status_created_idx
  on public.publish_jobs (status, created_at asc);

-- ---------- Storage ----------

insert into storage.buckets (id, name, public)
values ('organisation-media', 'organisation-media', true)
on conflict (id) do update set public = excluded.public;

-- ---------- Utility functions ----------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organisations_touch_updated_at on public.organisations;
create trigger organisations_touch_updated_at
before update on public.organisations
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists submitters_touch_updated_at on public.submitters;
create trigger submitters_touch_updated_at
before update on public.submitters
for each row execute function public.touch_updated_at();

drop trigger if exists submissions_touch_updated_at on public.submissions;
create trigger submissions_touch_updated_at
before update on public.submissions
for each row execute function public.touch_updated_at();

drop trigger if exists style_examples_touch_updated_at on public.style_examples;
create trigger style_examples_touch_updated_at
before update on public.style_examples
for each row execute function public.touch_updated_at();

-- Helper used by RLS policies.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organisation_members m
    where m.organisation_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organisation_members m
    where m.organisation_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- ---------- RLS ----------

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_members enable row level security;
alter table public.submitters enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_events enable row level security;
alter table public.style_examples enable row level security;
alter table public.organisation_ai_settings enable row level security;
alter table public.instagram_connections enable row level security;
alter table public.publish_jobs enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "organisations_select_member" on public.organisations;
create policy "organisations_select_member" on public.organisations
  for select to authenticated
  using (public.is_org_member(id));

drop policy if exists "organisation_members_select_member" on public.organisation_members;
create policy "organisation_members_select_member" on public.organisation_members
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "organisation_members_admin_write" on public.organisation_members;
create policy "organisation_members_admin_write" on public.organisation_members
  for all to authenticated
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

drop policy if exists "submitters_select_member" on public.submitters;
create policy "submitters_select_member" on public.submitters
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "submissions_select_member" on public.submissions;
create policy "submissions_select_member" on public.submissions
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "submissions_update_member" on public.submissions;
create policy "submissions_update_member" on public.submissions
  for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

drop policy if exists "submission_events_select_member" on public.submission_events;
create policy "submission_events_select_member" on public.submission_events
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "style_examples_select_member" on public.style_examples;
create policy "style_examples_select_member" on public.style_examples
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "style_examples_admin_write" on public.style_examples;
create policy "style_examples_admin_write" on public.style_examples
  for all to authenticated
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

drop policy if exists "ai_settings_select_member" on public.organisation_ai_settings;
create policy "ai_settings_select_member" on public.organisation_ai_settings
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "ai_settings_admin_write" on public.organisation_ai_settings;
create policy "ai_settings_admin_write" on public.organisation_ai_settings
  for all to authenticated
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

drop policy if exists "instagram_connections_admin_only" on public.instagram_connections;
create policy "instagram_connections_admin_only" on public.instagram_connections
  for all to authenticated
  using (public.is_org_admin(organisation_id))
  with check (public.is_org_admin(organisation_id));

drop policy if exists "publish_jobs_select_member" on public.publish_jobs;
create policy "publish_jobs_select_member" on public.publish_jobs
  for select to authenticated
  using (public.is_org_member(organisation_id));

drop policy if exists "publish_jobs_insert_member" on public.publish_jobs;
create policy "publish_jobs_insert_member" on public.publish_jobs
  for insert to authenticated
  with check (public.is_org_member(organisation_id));

drop policy if exists "organisation_media_select_authenticated" on storage.objects;
create policy "organisation_media_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'organisation-media');

-- ---------- Seed one organisation ----------
-- Replace these values for the first club.
-- insert into public.organisations (id, name, slug, whatsapp_number)
-- values ('00000000-0000-0000-0000-000000000000', 'Example Rugby League Club', 'example-rlc', 'whatsapp:+61000000000');


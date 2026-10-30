-- Study data collection schema (InkParse efficacy study, protocol v1.2)
-- Run this in the Supabase SQL editor (or `supabase db push` after linking).
--
-- Design notes:
--   * Corpus labels (R1..R261) live in the app manifest, not in the database.
--     Entries and validations reference corpus_label as plain text.
--   * Timing is captured automatically: opened_at comes from the browser when a
--     record is displayed, submitted_at is set by the server on save.
--     duration_seconds is generated from the two timestamps so it can never
--     drift from the logged times.
--   * Single-tenant: any signed-in member may read study rows (the validator
--     and overview pages need cross-user reads). Entry inserts/updates are
--     scoped to the participant; validation inserts are scoped to the
--     validator, but validation updates are open so audits can be corrected.

-- ============================================================
-- Entries: one row per (condition, corpus record)
-- ============================================================
create table if not exists public.study_entries (
  id uuid primary key default gen_random_uuid(),
  condition text not null check (condition in ('control', 'experimental')),
  corpus_label text not null,
  participant uuid not null default auth.uid() references auth.users (id),
  opened_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  duration_seconds numeric not null
    generated always as (extract(epoch from (submitted_at - opened_at))) stored,
  client_name text,
  phone_number text,
  date text,
  date_promised text,
  instructions text,
  price numeric,
  input_tokens integer,
  output_tokens integer,
  interrupted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint study_entries_unique unique (condition, corpus_label)
);

create index if not exists study_entries_label_idx
  on public.study_entries (corpus_label);
create index if not exists study_entries_participant_idx
  on public.study_entries (participant);

-- ============================================================
-- Validations: Person C audit of the experimental transcription
-- against the ground-truth control record.
-- ============================================================
create table if not exists public.study_validations (
  id uuid primary key default gen_random_uuid(),
  corpus_label text not null unique,
  validator uuid not null default auth.uid() references auth.users (id),
  major_correction boolean not null,
  wrong_client_name boolean not null default false,
  wrong_phone_number boolean not null default false,
  wrong_date boolean not null default false,
  wrong_date_promised boolean not null default false,
  wrong_instructions boolean not null default false,
  wrong_price boolean not null default false,
  notes text,
  validated_at timestamptz not null default now()
);

create index if not exists study_validations_validator_idx
  on public.study_validations (validator);

-- ============================================================
-- Archives: immutable snapshots of the collected dataset
-- ============================================================
create table if not exists public.study_archives (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  control_count integer not null default 0,
  experimental_count integer not null default 0,
  validation_count integer not null default 0,
  snapshot jsonb not null
);

create index if not exists study_archives_created_idx
  on public.study_archives (created_at desc);

-- ============================================================
-- Row level security
-- ============================================================
alter table public.study_entries enable row level security;
alter table public.study_validations enable row level security;
alter table public.study_archives enable row level security;

-- Entries: everyone signed in can read; only the participant writes their rows.
drop policy if exists study_entries_select on public.study_entries;
create policy study_entries_select on public.study_entries
  for select to authenticated
  using (true);

drop policy if exists study_entries_insert on public.study_entries;
create policy study_entries_insert on public.study_entries
  for insert to authenticated
  with check (participant = auth.uid());

drop policy if exists study_entries_update on public.study_entries;
create policy study_entries_update on public.study_entries
  for update to authenticated
  using (participant = auth.uid())
  with check (participant = auth.uid());

drop policy if exists study_entries_delete on public.study_entries;
create policy study_entries_delete on public.study_entries
  for delete to authenticated
  using (participant = auth.uid());

-- Validations: same pattern.
drop policy if exists study_validations_select on public.study_validations;
create policy study_validations_select on public.study_validations
  for select to authenticated
  using (true);

drop policy if exists study_validations_insert on public.study_validations;
create policy study_validations_insert on public.study_validations
  for insert to authenticated
  with check (validator = auth.uid());

-- Updates are open to any signed-in member (single-tenant study). Upserts on
-- corpus_label take the UPDATE path; locking them to validator = auth.uid()
-- blocks re-edits and corrections by other members.
drop policy if exists study_validations_update on public.study_validations;
create policy study_validations_update on public.study_validations
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists study_validations_delete on public.study_validations;
create policy study_validations_delete on public.study_validations
  for delete to authenticated
  using (validator = auth.uid());

-- Archives: readable by all signed-in members, append-only.
drop policy if exists study_archives_select on public.study_archives;
create policy study_archives_select on public.study_archives
  for select to authenticated
  using (true);

drop policy if exists study_archives_insert on public.study_archives;
create policy study_archives_insert on public.study_archives
  for insert to authenticated
  with check (created_by = auth.uid());

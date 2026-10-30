-- Allow any signed-in member to edit study validations.
--
-- saveStudyValidation uses upsert on corpus_label. On conflict Postgres takes
-- the UPDATE path and checks the existing row against UPDATE USING. The old
-- policy required validator = auth.uid(), so re-saving (or correcting another
-- member's audit) failed with:
--   new row violates row-level security policy (USING expression)
--
-- This matches the existing SELECT policy (any authenticated member may read).

drop policy if exists study_validations_update on public.study_validations;
drop policy if exists "Study validations update policy" on public.study_validations;
drop policy if exists "Enable update for validators" on public.study_validations;

create policy study_validations_update on public.study_validations
  for update to authenticated
  using (true)
  with check (true);

-- Keep insert ownership; drop duplicate policies created under other names.
drop policy if exists "Study validations select policy" on public.study_validations;
drop policy if exists "Study validations insert policy" on public.study_validations;
drop policy if exists "Enable read access for all users" on public.study_validations;
drop policy if exists "Enable insert for validators" on public.study_validations;

drop policy if exists study_validations_select on public.study_validations;
create policy study_validations_select on public.study_validations
  for select to authenticated
  using (true);

drop policy if exists study_validations_insert on public.study_validations;
create policy study_validations_insert on public.study_validations
  for insert to authenticated
  with check (validator = (select auth.uid()));

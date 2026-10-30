-- Flag relative / non-calendar date-promised wording on cards
-- (e.g. "10 days", "week-ish") so date-promised error rates can be
-- reported including vs excluding those cases.

alter table public.study_validations
  add column if not exists novel_promissory_format boolean not null default false;

comment on column public.study_validations.novel_promissory_format is
  'True when the card uses a relative or non-calendar promissory wording (e.g. "10 days") rather than a calendar date.';

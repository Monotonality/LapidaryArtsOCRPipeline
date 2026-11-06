-- Date promised as written on the card.
--
-- Staff often write a duration ("2-3 weeks", "10 days ish") instead of a
-- calendar date, and records.date_promised is a date column, so that text had
-- nowhere to go. date_promised_text keeps what was written when it is not a
-- plain date. When it is a duration and the record has a Date received,
-- records.date_promised still holds the due date worked out from it (received
-- + the longer end of the range), so the dashboard's date filter and sort keep
-- working.
--
-- Only the records ledger changes. study_entries is untouched so study
-- entries stay comparable across the collection period.
--
-- Apply this before deploying the code that reads the column: the dashboard
-- and edit page select it.

alter table public.records
  add column if not exists date_promised_text text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'records_date_promised_text_len') then
    alter table public.records add constraint records_date_promised_text_len
      check (date_promised_text is null or char_length(date_promised_text) <= 100);
  end if;
end $$;

comment on column public.records.date_promised_text is
  'Date promised as written on the card when it is not a plain date (e.g. "2-3 weeks"). date_promised holds the computed due date when one could be worked out.';

-- Per-field N/A and Invalid flags for records and study entries.
--
--   na_fields       fields that are not on the card (was: the literal "N/A"
--                   stored in text columns; price and the records date
--                   columns could not hold it at all).
--   invalid_fields  fields that are on the card but unreadable or not a valid
--                   value (new, mirrors na_fields).
--
-- A flagged field keeps its value column null. Values are the column names:
-- client_name, phone_number, date, date_promised, instructions, price.

alter table public.records
  add column if not exists na_fields text[] not null default '{}',
  add column if not exists invalid_fields text[] not null default '{}';

alter table public.study_entries
  add column if not exists na_fields text[] not null default '{}',
  add column if not exists invalid_fields text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'records_field_flags_check') then
    alter table public.records add constraint records_field_flags_check check (
      na_fields <@ array['client_name','phone_number','date','date_promised','instructions','price']::text[]
      and invalid_fields <@ array['client_name','phone_number','date','date_promised','instructions','price']::text[]
      and not (na_fields && invalid_fields)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'study_entries_field_flags_check') then
    alter table public.study_entries add constraint study_entries_field_flags_check check (
      na_fields <@ array['client_name','phone_number','date','date_promised','instructions','price']::text[]
      and invalid_fields <@ array['client_name','phone_number','date','date_promised','instructions','price']::text[]
      and not (na_fields && invalid_fields)
    );
  end if;
end $$;

-- Move legacy "N/A" markers out of the study text columns into na_fields.
update public.study_entries set
  na_fields = array(
    select unnest(na_fields)
    union
    select f from (values
      ('client_name', client_name),
      ('phone_number', phone_number),
      ('date', date),
      ('date_promised', date_promised),
      ('instructions', instructions)
    ) as v(f, val)
    where val = 'N/A'
  ),
  client_name   = nullif(client_name, 'N/A'),
  phone_number  = nullif(phone_number, 'N/A'),
  date          = nullif(date, 'N/A'),
  date_promised = nullif(date_promised, 'N/A'),
  instructions  = nullif(instructions, 'N/A')
where 'N/A' in (client_name, phone_number, date, date_promised, instructions);

-- Same for records (only its text columns could ever have held "N/A").
update public.records set
  na_fields = array(
    select unnest(na_fields)
    union
    select f from (values
      ('client_name', client_name),
      ('phone_number', phone_number),
      ('instructions', instructions)
    ) as v(f, val)
    where val = 'N/A'
  ),
  client_name  = nullif(client_name, 'N/A'),
  phone_number = nullif(phone_number, 'N/A'),
  instructions = nullif(instructions, 'N/A')
where 'N/A' in (client_name, phone_number, instructions);

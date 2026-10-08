# LapidaryArtsOCRPipeline

UTD Capstone 2026 — digitizing Lapidary Arts Jewelry's historical handwritten
invoices. A Next.js app that reads photos with an AI vision model via OpenRouter,
then lets staff verify and save records to a Supabase ledger.

## How it works

1. Staff capture a photo of a paper invoice on the **Add record** page.
2. The browser rotates and downsizes the image, then sends it through a secure
   server route to the configured OpenRouter vision model.
3. The model extracts the six invoice fields (Client Name, Phone Number, Date,
   Date Promised, Instructions/Article Details, and Price) with quoted source
   evidence.
4. Field safeguards validate formats: phone numbers, dates, and amounts are
   verified. Handwritten text and ambiguous values stay as suggestions for
   staff review rather than auto-filling unverified.
5. Staff review the photo against the suggestions, accept or edit values, check
   the confirmation box, and save the verified record.
6. Records live in Supabase and can be filtered, viewed, and exported to CSV
   from the dashboard.

## Stack

- **Next.js 16** (App Router, React 19)
- **Supabase** (Postgres + Auth) via `@supabase/ssr`
- **OpenRouter** — AI vision photo reader
- Deployed on **Vercel**

## Accounts & team model

There is **no self-signup and no email flow** for passwords. Accounts are
admin-created:

- The **first admin** is created in the Supabase Dashboard
  (Authentication > Users > Add user); a DB trigger auto-creates the matching
  `profiles` row as `approved`.
- The admin adds further members from the **Team** page (email + temporary
  password), which creates the Supabase Auth user confirmed and approved
  immediately.
- Members change their own password in **Settings**; the admin can reset a
  member's password from **Team** when it's forgotten.
- There is **exactly one admin**, enforced by a partial unique index on
  `profiles.is_admin`. The admin can hand the role off to an active member by
  typing that member's email as confirmation.
- Deactivated members (`profiles.status = 'deleted'`) keep their profile and
  their email on records, but can't sign in.

## Getting started

Copy `.env.example` to `.env.local`, then fill in the credentials you need:

```bash
npm install
npm run dev
```

### Environment variables

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Publishable key for browser/server sessions |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | `createAdmin()` — creating users, resetting passwords (never exposed to the client) |
| `NEXT_PUBLIC_SITE_URL` | client | Canonical site URL |
| `OPENROUTER_API_KEY` | server only | OpenRouter photo reader; never exposed to the browser |
| `OPENROUTER_MODEL` | server only | Model override (e.g. `google/gemma-4-31b-it:free`) |

`SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` are server-only secrets and
are never exposed to client components.

### Scripts

```bash
npm run dev      # local dev (http://localhost:3000)
npm run build    # production build
npm run start    # serve a production build
npx tsc --noEmit # typecheck
```

Without Supabase credentials, open `http://localhost:3000/ocr-demo` in development
to test the photo reader and review form.

## Database

The `profiles` table is the account/team store:

```text
profiles(id, email, status, is_admin, created_at, deleted_at, ...)
```

- `status`: `approved` | `deleted`
- `is_admin`: unique admin flag (at most one `true`, via `profiles_single_admin`).

The `records` table holds verified records produced by the validation flow.

## Deploy

Production is deployed from the CLI:

```bash
npx vercel --prod --yes
```

The alias `https://lapidary-arts-ocr-pipeline.vercel.app` points at the latest ready deployment.

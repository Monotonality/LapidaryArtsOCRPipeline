# LapidaryArtsOCRPipeline

UTD Capstone 2026 — digitizing Lapidary Arts Jewelry's historical handwritten
invoices. A Next.js app that runs OCR (in the browser via Transformers.js) on
photos of physical records and lets staff verify and save them to a Supabase
ledger.

## How it works

1. Staff capture a photo of a paper invoice.
2. OCR + a lightweight model suggest the six fields (Client Name, Phone Number,
   Date, Date Promised, Instructions/Article Details, Price).
3. A human reviews and corrects the recommendation, then saves the verified
   record.
4. Records live in Supabase and can be filtered, viewed, and exported to CSV
   from the dashboard.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Supabase** (Postgres + Auth) via `@supabase/ssr`
- **@huggingface/transformers** — client-side OCR, no server inference
- Deployed on **Vercel**

## Accounts & team model

There is **no self-signup and no email flow** for passwords. Accounts are
admin-created:

- The **first admin** is created once in the Supabase Dashboard
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

See `docs/workflow-diagram.md` for the full flow, and `docs/style-guide.md`
for the design system.

## Getting started

Local dev needs a Supabase project and the keys below.

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
| `NEXT_PUBLIC_SITE_URL` | client | Canonical site URL for the OAuth callback |

`SUPABASE_SERVICE_ROLE_KEY` must be set as a **secret** in Vercel; it is never
read in client components.

### Scripts

```bash
npm run dev      # local dev (http://localhost:3000)
npm run build    # production build
npm run start    # serve a production build
npx tsc --noEmit # typecheck
```

Revert `next-env.d.ts` before committing (it regenerates per environment), and
run `npx tsc --noEmit` after deleting routes so stale `.next` types are caught.

## Database

The `profiles` table is the account/team store:

```text
profiles(id, email, status, is_admin, created_at, deleted_at, ...)
```

- `status`: `approved` | `deleted` (account lifecycle only — records have no
  status column; drafts/OCR state is frontend-only).
- `is_admin`: the unique admin flag (at most one `true`, via
  `profiles_single_admin`).
- RLS policies restrict reads to authenticated users and account management to
  the admin. `transfer_admin(new_admin_id uuid)` is a SECURITY DEFINER function
  that the admin calls to hand off the role.

The `records` table holds verified records produced by the validation flow.

## Deploy

Production is deployed from the CLI (not git integration):

```bash
npx vercel --prod --yes
```

Follow the build in the Vercel dashboard; the alias
`https://lapidary-arts-ocr-pipeline.vercel.app` points at the latest ready
deployment.

## Docs

- `docs/workflow-diagram.md` — mermaid flow + team model
- `docs/style-guide.md` — design tokens and UI conventions
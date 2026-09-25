# LapidaryArtsOCRPipeline

UTD Capstone 2026 — digitizing Lapidary Arts Jewelry's historical handwritten
invoices. A Next.js app that reads photos with a local Ollama vision model or
an optional OpenRouter model,
then lets staff verify and save records to a Supabase ledger.

## How it works

1. Staff capture a photo of a paper invoice.
2. The browser rotates and downsizes the image, then calls the staff computer's
   Ollama server directly. `qwen3-vl:4b-thinking` proposes the six existing
   fields with source evidence. Code checks phone, date, and price formats;
   uncertain values stay as suggestions instead of filling the form.
3. Staff can instead choose **Read with OpenRouter (cloud)**. The app sends the
   prepared photo through a server route to the configured OpenRouter model;
   the API key stays on the server. This is an explicit choice in the UI.
4. Staff review the photo, accept or edit suggestions, and confirm all values
   before saving. PaddleOCR remains an optional fallback with text selection
   and crop tools. A model or network failure does not block manual entry.
5. Records live in Supabase and can be filtered, viewed, and exported to CSV
   from the dashboard.

## Stack

- **Next.js 16** (App Router, React 19, webpack build)
- **Supabase** (Postgres + Auth) via `@supabase/ssr`
- **Ollama** with `qwen3-vl:4b-thinking` — local whole-photo reader
- **OpenRouter** with `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` — optional cloud reader
- **@paddleocr/paddleocr-js** — optional client-side PP-OCRv6 fallback
- Deployed on **Vercel**

The default local reader sends the prepared photo to `http://localhost:11434`
on the staff member's machine. The OpenRouter option sends the photo to the
Next.js server, then to OpenRouter and its selected provider. Saving writes verified fields to `records`; this flow does not
archive the photo or OCR provenance. Handwriting quality still varies, so
staff must check every value against the image.

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

Install [Ollama](https://ollama.com/download) on each staff Mac or Windows PC,
then pull the model:

```bash
ollama pull qwen3-vl:4b-thinking
```

Keep Ollama running while using the Add page. The model download is about
3.3 GB. A Mac with Apple Silicon or a Windows PC with a GPU is recommended;
CPU-only inference will be slow. The first call may take longer while the model
loads. Each staff machine needs its own Ollama installation and model download.

Ollama must allow the web app's exact origin. Set `OLLAMA_ORIGINS` to include
the origin(s) that staff actually open, then restart Ollama. For example:

```bash
OLLAMA_ORIGINS="http://localhost:3000,https://lapidary-arts-ocr-pipeline.vercel.app" ollama serve
```

For the macOS Ollama app, use `launchctl setenv OLLAMA_ORIGINS
"http://localhost:3000,https://lapidary-arts-ocr-pipeline.vercel.app"` and restart
the app. On Windows, set `OLLAMA_ORIGINS` in your user environment variables,
then quit and reopen Ollama. Include any additional deployment origin used by
your team. Keep Ollama bound to localhost; the browser makes the request from
the same machine. If Chrome asks to allow local network access from an HTTPS
site, permit access to local Ollama for this app.

Copy `.env.example` to `.env.local`, then fill in the credentials you need.
Local dev needs a Supabase project and its keys for login and saving records.
The development OCR demo can run without Supabase.

To enable the optional OpenRouter reader, put your key in `.env.local` as
`OPENROUTER_API_KEY=...` and restart Next.js. The example sets
`OPENROUTER_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`.
Configure the same server-only variables in your deployment environment if
the deployed Add page should offer OpenRouter. Never prefix the API key with
`NEXT_PUBLIC_`. The free model may have availability or rate limits; staff can
use local Ollama, PaddleOCR, or manual entry if it is unavailable.

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
| `OPENROUTER_API_KEY` | server only | Optional OpenRouter photo reader; never exposed to the browser |
| `OPENROUTER_MODEL` | server only | Optional model override; defaults to Nemotron free |

`SUPABASE_SERVICE_ROLE_KEY` must be set as a **secret** in Vercel; it is never
read in client components.

### Scripts

```bash
npm run dev      # local dev (http://localhost:3000)
npm run build    # production build
npm run start    # serve a production build
npx tsc --noEmit # typecheck
```

Without Supabase credentials, start the dev server and open
`http://localhost:3000/ocr-demo` to test the same Add photo reader and review
form. This route
exists only in development and does not save records. For the authenticated
app and saving, set the Supabase variables below in `.env.local`.

For a local Gemma 4 E2B comparison, pull `gemma4:e2b` in Ollama and open
`http://localhost:3000/ocr-demo?model=gemma4:e2b`. This override is limited to
the development demo. Qwen remains the Add page default because the three
sample invoices exposed more wrong field assignments with Gemma, including
invented dates on a form with blank date fields.

The dev and build scripts use webpack because the PaddleOCR fallback requires
browser fallbacks for OpenCV's Node imports. If Ollama is unavailable, verify
that it is running, run `ollama pull qwen3-vl:4b-thinking`, check
`OLLAMA_ORIGINS`, and reload the Add page. Staff can use PaddleOCR or manual
entry meanwhile. Date Promised is a date column: durations such as "10 days"
stay visible as suggestions and are never converted to an invented date.

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

- [OCR guide](docs/OCR/README.md) — reader architecture, OpenRouter setup, safeguards, and browser test results
- `docs/workflow-diagram.md` — mermaid flow + team model
- `docs/style-guide.md` — design tokens and UI conventions

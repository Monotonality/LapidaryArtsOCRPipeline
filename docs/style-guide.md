# Lapidary Arts Records — Style Guide

Design tokens and UI conventions for the Lapidary Arts OCR Pipeline app.
Tokens live in `app/globals.css` and are the single source of truth — change
them there, never inline.

## Brand

Lapidary Arts Jewelry digitizes historical handwritten invoices. The interface
mirrors the archive room: warm parchment neutrals, archival ink, and a dark
"claret" red — the color of a jeweler's wax seal and gem-foil linings.

- **Voice:** concise, trustworthy, archival.
- **Mood:** calm and legible first; decorative only as a "splash."
- **Signature motif:** a rotated-square gem mark (brand mark) reserved for
  authentication screens and the dashboard masthead.

## Color

### Claret (brand scale)

| Token          | Hex     | Use                                                        |
| -------------- | ------- | ---------------------------------------------------------- |
| `--claret-50`  | `#fcf1f3` | Tinted page washes (light theme)                          |
| `--claret-100` | `#f9e2e7` | `--accent-soft` (light theme washes)                       |
| `--claret-200` | `#f0c7cf` | `--accent-border` (light theme)                            |
| `--claret-300` | `#e39dab` | Hover tints, disabled-adjacent colors                      |
| `--claret-500` | `#b9425f` | Data-viz accents (spark lines, chart dots)                 |
| `--claret-700` | `#8c1d33` | **Brand anchor**; `--accent` in light theme                |
| `--claret-800` | `#741828` | Gradients, pressed state                                   |
| `--claret-900` | `#5c1220` | Text-on-brand, deep backgrounds                            |

Dark theme raises the accent one stop for contrast: `--accent: #d44763`.

### Semantic tokens

Apply semantics only through the named token, not raw hex:

| Token            | Light   | Dark    | Use                          |
| ---------------- | ------- | ------- | ---------------------------- |
| `--bg`           | `#faf7f6` | `#170e11` | Page background (warm paper) |
| `--surface`      | `#ffffff` | `#1e1519` | Cards, inputs, tables        |
| `--surface-muted`| `#f3eeec` | `#261b20` | Subtle wells, table stripes  |
| `--text`         | `#261a1d` | `#f2e8ea` | Primary copy                 |
| `--text-muted`   | `#6e5f63` | `#b5a2a7` | Secondary copy               |
| `--text-faint`   | `#92807f` | `#8a767c` | Placeholders, timestamps     |
| `--border`       | `#e7dddc` | `#3b2a30` | Hairlines, input borders     |
| `--border-strong`| `#d3c7c5` | `#503a42` | Emphasized borders           |
| `--accent`       | `#8c1d33` | `#d44763` | Primary actions, links, focus|
| `--accent-hover` | `#a1253f` | `#dd5b74` | Hover state for accent       |
| `--accent-soft`  | `#f9e2e7` | `#3a1f28` | Tinted washes, active nav    |
| `--accent-border`| `#f0c7cf` | `#6a3040` | Accent-tinted borders        |
| `--on-accent`    | `#fff6f7` | `#fff4f6` | Text/labels on accent fills  |
| `--ring`         | rgba claret | rgba brighter | Focus rings        |
| `--success` / soft / border |       |          | Positive alerts, valid state|
| `--danger`  / soft / border    |       |          | Errors, destructive actions |

Rules:

- Never put raw brand hex in components; reference the token.
- Accent fills need `--on-accent` copy — never white or `--text` directly.
- Light and dark themes both use the same token *names*; only values differ.

## Typography

- Fonts are bound to tokens in `app/globals.css` — never set a font in a
  component.
- **Fraunces** (`--font-display`) — a wonky editorial serif with italics.
  Display only: headings, page titles, the brand wordmark. The "human"
  ink-slop look that generic sans (Inter, Geist, Roboto, system-ui) can't.
- **Archivo** (`--font-sans`) — UI and body copy: labels, paragraphs,
  buttons, inputs.
- **Space Mono** (`--font-mono`) — data: record IDs, phone numbers,
  timestamps, eyebrows, status counts, panel footnotes.

| Style        | Token/values        | Use                                  |
| ------------ | ------------------- | ------------------------------------ |
| Display      | serif 1.5rem / 600  | Page titles (dashboard masthead)     |
| Title        | serif 1.375rem / 600 | Card titles (auth screens)          |
| Section      | serif 1.125rem / 600 | Pending signups, Records headings    |
| Body         | 0.9375rem / 1.5     | Default                             |
| Small        | 0.8125rem / 1.4     | Meta, table cells, hints             |
| Eyebrow      | mono 0.6875rem / .18em ls / small-caps | Above auth titles, panel tags |
| Data         | 0.8125rem mono      | Phone numbers, timestamps            |

- Two-tone hero pattern: brand mark + strong name, muted descriptor
  (e.g., "Lapidary Arts Records" + "Records").
- Headings render in serif with `text-wrap: balance`; never set body copy
  in the display face.

## Shape & Space

- Radius scale: `--radius-sm` 6px (inputs, badges), `--radius-md` 10px
  (buttons, cards in lists), `--radius-lg` 16px (large cards).
- Spacing is 4px-based: `--space-1` 4px … `--space-12` 48px.
- Card padding: `var(--space-6)` (24px). Component padding: `--space-3`–`--space-4`.

## Elevation

- `--shadow-xs/sm/md/lg`. Use **borders not shadows** for resting states;
  shadows announce interactive or elevated surfaces.
- Cards: `--border` hairline + `--shadow-sm`. Modal/elevated: `--shadow-lg`.

## Components

### Buttons
- **Primary:** `--accent` fill, `--on-accent` text, radius `--radius-md`,
  600 weight, `--shadow-xs`. Hover: `--accent-hover`. Active: darken + translateY(1px).
- **Secondary/ghost:** transparent, `--border-strong` hairline, `--text` copy;
  hover raises to `--surface-muted`.
- **Danger:** `--danger` fill for destructive confirms (no default affirmative danger).
- Disabled: opacity 0.55, no pointer events, no shadow.
- Min touch target height: 40px.

### Inputs
- `--surface` fill, `--border` hairline, radius `--radius-sm`.
- Focus: `border-color: var(--accent)` + `3px --ring` shadow (replaces outline).
- Error state: `--danger-border` border + `--danger-soft` wash.
- Placeholder: `--text-faint`.

### Alerts
- Success/error/info use soft fill + hairline border + semantic text,
  radius `--radius-sm`. Optional glyph prefix (✓ / ✕ via CSS, no icon dependency).

### Cards
- `--surface`, `--border`, `--shadow-sm`, radius `--radius-lg`.

### Tables
- Hairline `--border` column/row separators; optional striped rows with
  `--surface-muted`; sticky header on scroll with `1px --border` bottom rule.
- Numeric right-align; data in `--font-mono` where tabular.
- Header cells: `--text-muted`, 600 weight, small caps optional.

### Status
- Pending: claret (`--accent` as soft pill). Approved/active: `--success` pill.
- `deleted`: soft-deleted accounts keep their profile (and email on records)
  but lose access; shown as a neutral pill, not a success/failure color.

## Against the generic

This project tries not to *look* AI-generated. The specific anti-patterns
it guards against, and the house rules:

- **No default-alike fonts.** No Inter, Geist, Roboto, system stack for
  display. A bespoke serif + grotesque + mono pairing is a harder tell than
  any layout trick.
- **Not one centered card on an empty page.** Auth screens are a two-panel
  ledger composition (`AuthShell`): a dark claret brand panel with the gem
  lattice and mono footnotes beside the real form. Single-column centered
  cards read as template output.
- **No arbitrary `rounded-2xl + shadow-lg + p-6` cards.** Cards use the
  token radius/shadow scale; the two-panel auth *stage* is a bordered window
  with a hairline, not an everywhere-shadow.
- **No gradient slop.** Thin accent bars are flat (`background: var(--accent)`).
  Gradients are reserved for the brand panel background and the gem mark
  fill — never for emphasizing tiny UI chrome.
- **Restraint on rounded corners.** Inputs `--radius-sm`, buttons `--radius-md`,
  stage/cards `--radius-lg`. Not everything is a pill.
- **Copy is specific and human.** No "Access your dashboard", no
  "seamless experience", no emoji as decoration. State what this tool
  actually does ("Handwritten invoices, typed up — record by record.").
  Remove developer-speak from user-facing strings.
- **Texture over flatness.** A faint SVG-turbulence grain (`--noise`,
  ~3% overlay opacity) sits over the paper background and the panel. Cheap,
  tactile, invisible to anyone not looking for it.
- **Motion only when it means something.** Shared `rise` keyframe for
  page-entrance (transform/opacity, < 500ms, delayed in sequence). Fully
  disabled under `prefers-reduced-motion`. No autoplay, no parallax.
- **Words in mono are deliberate.** Eyebrows, panel footnotes, and tabular
  data use `--font-mono` as an archival "ledger entry" tell — not as a
  font-website flex.

## Interaction

- Hover: 150ms `--ease` on color/shadow/transform; press: 75ms.
- Focus visible: `outline: 2px var(--ring)`, 2px offset.
- Selection: accent background, `--on-accent` text.

## Accessibility

- Contrast of all text ≥ WCAG AA on its background (checked in both themes).
- Semantic HTML: `label` for inputs, `role="alert"` / `aria-live` for alerts,
  real buttons/links (no `<div onClick>`).
- Motion: no auto-play, no parallax; transitions are transform/opacity only if possible.
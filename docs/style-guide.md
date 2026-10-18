# InkParse Style Guide

Design tokens and UI conventions for the InkParse app (Lapidary Arts OCR
Pipeline). The full specification lives in `design-brief.html` at the repo
root; the implementation lives in `app/globals.css`. Change tokens there,
never inline.

## Brand

InkParse digitizes the handwritten job cards of Lapidary Arts Jewelry. The
interface is corporate and pragmatic: black and white carry the layout, gray
handles structure, and two accents carry meaning.

- **Voice:** plain, direct, process language ("Done by a person",
  "Suggested by the model"). No marketing tone, no emoji, no em dashes.
- **Wordmark:** square mark with the letter "I" and a green baseline,
  followed by "Inter"-set "InkParse".
- **Palette rule:** black, white, and gray are always allowed. Green and
  purple together may never exceed 5% of a screen.

## Color

### Core palette

| Token         | Hex       | Use                                       |
| ------------- | --------- | ----------------------------------------- |
| `--gray-900`  | `#111113` | Primary text, default buttons, page ticks |
| `--gray-700`  | `#4b4d52` | Secondary text                            |
| `--gray-500`  | `#8a8d94` | Placeholders, timestamps, muted UI        |
| `--gray-300`  | `#e4e6ea` | Hairlines                                 |
| `--gray-100`  | `#f6f7f8` | Page background                           |
| `--white`     | `#ffffff` | Cards, inputs, table surface              |
| `--green-600` | `#00653a` | Human-verified actions and states         |
| `--purple-600`| `#6d28d9` | Machine output, unconfirmed               |

### Semantic tokens

Apply semantics only through the named token, not raw hex:

| Token          | Light         | Use                                       |
| -------------- | ------------- | ----------------------------------------- |
| `--bg`         | `#f6f7f8`     | Page background                           |
| `--surface`    | `#ffffff`     | Cards, inputs, tables                     |
| `--surface-muted` | `#f6f7f8`  | Wells, active nav, row hover              |
| `--text`       | `#111113`     | Primary copy                              |
| `--text-muted` | `#4b4d52`     | Secondary copy                            |
| `--text-faint` | `#8a8d94`     | Placeholders, hints                       |
| `--border`     | `#e4e6ea`     | Hairlines, input borders                  |
| `--border-strong` | `#c9ccd2`  | Emphasized borders                        |
| `--accent`     | `#111113`     | Default action (Sign in, Export, Add)     |
| `--accent-soft`| `#eef0f2`     | Active nav, row hover, quiet tags         |
| `--green` / soft / border |      | Commit action (Save record), verified     |
| `--purple` / soft / border |      | Model output (Read card, suggestions)     |
| `--danger` / soft / border |      | Errors, destructive actions               |

Rules:

- **Green means a person confirmed it.** One green commit action per view
  (Save record, Confirm). Verified states use green pills.
- **Purple means the model produced it, and nobody has confirmed it yet.**
  The Read card button and the "suggested fields" note are purple. Purple
  never appears in navigation and never touches human-written content.
- Accent budget: green and purple combined stay under 5% of any screen.
- Light and dark themes share the same token names; only values differ.
  Dark theme flips the default action to a light fill and raises both
  accents one stop for contrast.

## Typography

- Fonts are bound to tokens in `app/globals.css`; never set a font in a
  component.
- **Inter** (`--font-sans`) handles all language: headings, labels, body,
  buttons. One sans, no display or serif face.
- **JetBrains Mono** (`--font-mono`) handles data only: record IDs, phone
  numbers, timestamps, counts, eyebrows.

| Style    | Values                             | Use                             |
| -------- | ---------------------------------- | ------------------------------- |
| Page h1  | sans 1.5rem / 600 / -0.02em        | Page titles with black tick bar |
| Section  | sans 1.125rem / 600                | Section headings                |
| Body     | 0.9375rem / 1.5                    | Default                         |
| Small    | 0.8125rem / 1.4                    | Meta, table cells, hints        |
| Eyebrow  | mono 0.6875rem / 0.16em ls / upper | Labels above auth titles        |
| Data     | 0.8125rem mono                     | Phone numbers, timestamps       |

## Shape & Space

- Radius: 4px everywhere (`--radius-sm/md/lg`), 3px for badges
  (`--radius-pill`). Never past 4px, never pill-shaped buttons.
- Spacing is 4px-based: `--space-1` 4px ... `--space-12` 48px.
- Borders, not shadows: all `--shadow-*` tokens resolve to `none`.

## Components

### Buttons
- **Default:** ink fill (`--accent`), `--on-accent` text, 4px radius,
  600 weight, 40px min height. Hover: `--accent-hover`.
- **Commit:** green fill (`--green`), one per view (Save record).
- **Model:** purple outline (`--purple` on `--purple-soft`), only for
  actions the machine performs (Read card).
- **Secondary:** transparent, `--border-strong` hairline, `--text` copy.
- **Danger:** `--danger` outline for destructive confirms only.
- Disabled: opacity 0.55, no pointer events.

### Inputs
- `--surface` fill, `--border` hairline, 4px radius, 40px min height.
- Focus: `border-color: var(--text)` + 2px `--ring` shadow.
- Error: `--danger-border` border + `--danger-soft` wash.
- Placeholder: `--text-faint`.

### Alerts
- Soft fill + hairline border + semantic text, 4px radius, glyph prefix
  (checkmark or cross via CSS, no icon dependency).

### Tables (ledger)
- Sticky header, 1px row rules, **no striping**, row hover in
  `--accent-soft`, hairline `--border` frame, 4px radius.
- Numeric right-align; tabular data in `--font-mono`.
- Header cells: `--text-muted`, 600 weight, uppercase, 0.05em tracking.

### Status
- Verified (`approved`): green pill, 3px radius.
- `deleted`: neutral gray pill, no color judgment.
- Model-produced content: purple until a person confirms it.

## Motion

- Motion exists only for hover and focus. No scroll animation, no page
  entrance animation, no parallax, no autoplay.
- Hover: 150ms `--ease` on color; press: 75ms translateY(1px).
- Focus visible: 2px `--text` outline, 2px offset.
- Fully disabled under `prefers-reduced-motion`.

## Accessibility

- Contrast of all text meets WCAG AA on its background, both themes.
- Semantic HTML: `label` for inputs, `role="alert"` for alerts, real
  buttons and links (no `div onClick`).
- Hit targets are at least 40px tall.

## Copy rules

- Never use em dashes in interface copy, labels, hints, or docs. Use a
  colon, comma, semicolon, or full stop instead.
- No marketing language, no emoji as decoration, no developer-speak.
  State what the tool does ("Digitizing the handwritten job cards of
  Lapidary Arts Jewelry, one invoice at a time.").

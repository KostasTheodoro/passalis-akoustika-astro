# Passalis Akoustika

Website for Passalis Akoustika, a hearing-aid practice based in Greece.

## Stack

- [Astro](https://astro.build) — static-first page generation
- TypeScript, in strict mode
- [Tailwind CSS](https://tailwindcss.com) v4, via the Vite plugin
- [React](https://react.dev) — reserved for interactive islands only
- [Biome](https://biomejs.dev) — formatting and linting
- [Playwright](https://playwright.dev) — browser tests
- [Vercel](https://vercel.com) — hosting, via `@astrojs/vercel`

## Prerequisites

- [Bun](https://bun.com) 1.3 or newer. Bun is the package manager and the unit-test
  runner for this project — npm, pnpm, and Yarn are not used, and no other lockfile
  should be committed.
- Node.js 22.12 or newer.

## Setup

```bash
bun install
```

Copy `.env.example` to `.env` and adjust the values for your machine:

```bash
cp .env.example .env
```

Browser tests need their browser downloaded once:

```bash
bunx playwright install chromium
```

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dev server on `http://localhost:4321` |
| `bun run build` | Build the production site into `dist/` |
| `bun run preview` | Serve the built site from `dist/` on `http://localhost:4321` |
| `bun run check` | Type-check `.astro` and TypeScript files |
| `bun run biome` | Check formatting and lint rules |
| `bun run biome:fix` | Apply safe formatting and lint fixes |
| `bun run test` | Run unit tests with Bun's test runner |
| `bun run test:e2e` | Run Playwright browser tests |

## Environment variables

Variables are declared and typed in `astro.config.mjs` under `env.schema`, and
documented in `.env.example`. `PUBLIC_SITE_URL` is exposed to the browser, so it
must never hold a secret. Real secrets belong in `.env` locally and in the Vercel
project settings in production; they are never committed.

## Project structure

```text
public/        Static assets served as-is
src/
  components/  UI components, grouped by role
  content/     Structured content collections
  data/        Shared typed data (business details, navigation)
  emails/      Email templates
  layouts/     Page shells
  lib/         Helpers for content, forms, SEO, and validation
  pages/       Routes, including API endpoints under pages/api
  styles/      Global stylesheet and Tailwind entry point
tests/e2e/     Playwright browser tests
tests/unit/    Bun unit tests
```

## Editing content

All site content lives in `src/content/` and `src/data/`. There is no CMS and no database —
you edit text files and commit them.

Two file formats are used, on one rule: **YAML for structured data, Markdown where the text is
prose.**

| What | Where | Format |
| --- | --- | --- |
| Hearing-aid categories | `src/content/hearing-types/` | `.yaml` |
| Hearing-aid models | `src/content/hearing-models/` | `.yaml` |
| Manufacturers | `src/content/providers/` | `.yaml` |
| FAQ entries | `src/content/faqs/` | `.md` |
| About and EOPYY pages | `src/content/pages/` | `.md` |
| Business details, navigation, home page copy | `src/data/` | TypeScript |

The **filename is the id**. For categories the id is also the public URL — `cic.yaml` is served
at `/akoustika/cic` — so renaming one of those four files changes a live URL and needs a
redirect. Model, provider and FAQ ids are internal today, but keep them lowercase Latin letters,
digits and hyphens: models may become their own pages later, and a check enforces this.

After any change, run `bun run check` and `bun run test`. Both must pass before committing.

### Add or edit a hearing model

Copy an existing file in `src/content/hearing-models/`, name it after the model, and edit:

```yaml
name: Signia Intuis CIC          # shown as the card heading
type: cic                        # must match a filename in hearing-types/
description: >-
  Free text. The `>-` lets you wrap across lines; they join into one paragraph.
imageAlt: Signia Intuis CIC      # describes the photo for screen readers
imageSources:
  - https://example.com/photo.jpg
order: 2                         # position within its category, starting at 1
featured: true                   # optional; shows it on the home page
```

`order` must run 1, 2, 3… within each category with no gaps, and exactly one model per category
may be `featured`. The tests will tell you if either rule is broken.

### Add or edit a FAQ

Create a file in `src/content/faqs/`. The question is frontmatter, the answer is the body, and
the body is Markdown, so links and lists work:

```markdown
---
question: Υπάρχει εγγύηση;
order: 6
---

Ναι, παρέχουμε διετή εγγύηση και συντήρηση για 3 χρόνια.
```

`order` decides the position in the list and must be unique.

### Update a provider

Edit the matching file in `src/content/providers/`. Names are stored in ordinary case
(`A&M Hearing`, not `A&M HEARING`) — the uppercase look on the page comes from the stylesheet,
so type them normally.

### Update business contact details

Everything — name, telephone, email, address, opening hours — lives in `src/data/business.ts`
and nowhere else. Change it there and every page follows.

The telephone is stored three times on purpose: `display` is what visitors read, `href` is what
the link dials, and `international` is used only by search-engine structured data. Keep all
three describing the same number; a test checks that they do.

### Replace an image

Images are still hosted on the manufacturers' own sites, recorded as `imageSource` /
`imageSources` for now. To swap one, replace the URL. Local copies and responsive sizes arrive
in a later step, at which point this section is updated.

Always set `imageAlt` to something that describes the picture. It is required — a missing one
fails the build.

### Update the EOPYY amounts

They appear twice inside `src/content/pages/eopyy.md`: in the `subsidy` frontmatter, which the
home page card and structured data read, and in the page's own prose. **Change both.** A test
fails if the two disagree, so they cannot silently drift.

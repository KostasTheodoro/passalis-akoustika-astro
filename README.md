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
public/        The handful of files that need a fixed URL: icons and the social image
src/
  assets/      Images, fonts and logos the build processes and fingerprints
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

Every image lives in this repository, under `src/assets/images/`:

| Folder | What is in it |
| --- | --- |
| `hero/` | The two home-page hero photographs — one wide for desktop, one square for mobile |
| `about/` | The five photographs on the About page |
| `hearing/` | One photograph per hearing-aid model, named after the model's file |
| `partners/` | Manufacturer logos, the ΕΟΠΥΥ logo, and the ΕΟΠΥΥ page banner |
| `badges/` | The App Store and Google Play badges |

To swap a photo, drop the new file into the right folder and point the entry at it:

```yaml
image: ../../assets/images/hearing/silk-cic.webp
imageAlt: Ζεύγος ενδοκαναλικών ακουστικών Signia Silk CIC με μαύρη πρόσοψη
```

The path is always relative and always starts `../../assets/images/`, because every content
folder sits one level under `src/content/`. `bun run test` will tell you if the file is not
where you said it is.

**Give it a sensible size before committing it.** Astro generates the small, modern formats the
browser actually downloads, but it does that from whatever you commit, so a 12 MB photo makes
every build slower for no gain. As a rule of thumb: a product photo wants its longest edge
around 800px, an About photo around 1400px, and the hero no more than 2560px. A test enforces a
ceiling per folder, and will name the file if you go over.

Keep photographs as `.jpg`. Use `.webp` or `.png` only when the image genuinely needs a
transparent background — several product cut-outs and the ΕΟΠΥΥ banner do, and flattening them
would put a white box on the page.

Always set `imageAlt` (or `alt`) to something that describes the picture — what is in the frame,
not the model name that is already printed above it. It is required; a missing one fails the
build.

`imageSource` and `imageSources` are just a record of where a photo originally came from. The
site never loads them. Leave them alone unless you are replacing the photo, in which case update
them to match.

### Replace the logo or the icons

`src/assets/brand/` holds the logo as vector: `logo-wordmark.svg` is the full lockup for the
header, `logo-mark.svg` is the ear on its own. The browser-tab and phone icons in `public/`
(`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) are all
the same mark on a white square. Those five are the only images that live outside
`src/assets/` — they need fixed URLs, so they cannot be renamed by the build.

### Fonts

Sansation is served from `src/assets/fonts/sansation/` in four faces: regular, bold, italic and
bold italic. They are registered in `astro.config.mjs`; the regular and bold faces are preloaded
because they are what the top of a page needs. Nothing else has to name the family — Tailwind's
`font-sans` already resolves to it.

The light weight is deliberately not shipped, since nothing uses it. If a design ever calls for
it, copy the two `Light` files across from the legacy repository and add them to the config.

### Update the EOPYY amounts

They appear twice inside `src/content/pages/eopyy.md`: in the `subsidy` frontmatter, which the
home page card and structured data read, and in the page's own prose. **Change both.** A test
fails if the two disagree, so they cannot silently drift.

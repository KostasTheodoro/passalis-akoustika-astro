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
```

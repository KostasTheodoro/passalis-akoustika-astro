import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
// `z` is imported from `astro/zod` rather than `astro:content`, whose re-export Astro 7 has
// deprecated. Both resolve to the same Zod v4 namespace.
import { z } from 'astro/zod';

/**
 * Content collections for the site.
 *
 * Format rule: YAML for pure structured data, Markdown where the text is genuinely prose.
 * The entry id is always the filename without its extension, and for `hearing-types` that id
 * is also the public URL segment (`/akoustika/{id}`).
 *
 * Images are still remote hotlinks at this stage. Each entry therefore records `imageAlt` and
 * an `imageSource` (the legacy origin, kept for provenance and licensing review only, never
 * rendered). STEP-03 downloads the images and *adds* an `image` field alongside these, so
 * nothing defined here has to be redefined.
 */

/** Reusable per-entry search-engine metadata. */
const seo = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).default([]),
});

/** The four hearing-aid categories. The id is the public route segment. */
const hearingTypes = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/hearing-types' }),
  schema: z.object({
    /** Full title used on the listing card, e.g. "Ενδοκαναλικά – CIC (Completely in Canal)". */
    title: z.string(),
    /** Greek name alone, used as the category page heading, e.g. "Ενδοκαναλικά". */
    shortTitle: z.string(),
    /** Latin abbreviation shown beside the heading, e.g. "CIC". */
    latinAbbreviation: z.string(),
    /** Listing-card body copy. */
    description: z.string(),
    seo,
    imageAlt: z.string(),
    imageSource: z.url(),
    /** Display order, ascending. Must be unique within the collection. */
    order: z.number().int().positive(),
    featured: z.boolean().default(false),
  }),
});

/** Individual hearing-aid models, each belonging to exactly one category. */
const hearingModels = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/hearing-models' }),
  schema: z.object({
    name: z.string(),
    /**
     * The owning category. `reference()` only shapes the value — it does not verify that the
     * entry exists — so `src/lib/content/collections.ts` asserts resolution at build time.
     */
    type: reference('hearing-types'),
    description: z.string(),
    imageAlt: z.string(),
    imageSources: z.array(z.url()).min(1),
    /** Display order within the category, ascending. */
    order: z.number().int().positive(),
    /** Shown in the "Τα ακουστικά μας" section on the home page. */
    featured: z.boolean().default(false),
  }),
});

/** Frequently asked questions. The answer is the Markdown body. */
const faqs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    order: z.number().int().positive(),
  }),
});

/** Hearing-aid manufacturers the business works with. */
const providers = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/providers' }),
  schema: z.object({
    /** Stored in proper case; uppercasing is presentation and belongs in CSS. */
    name: z.string(),
    description: z.string(),
    features: z.array(z.string()).min(1),
    logoAlt: z.string(),
    /** Path to the logo in the legacy `public/` directory. STEP-03 localizes it. */
    logoSource: z.string(),
    website: z.url(),
    order: z.number().int().positive(),
  }),
});

/** Long-form editorial pages. The prose is the Markdown body. */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    /** Page heading. */
    title: z.string(),
    description: z.string(),
    seo,
    /** Images belonging to the page. The template decides how they are arranged. */
    images: z
      .array(
        z.object({
          source: z.string(),
          alt: z.string(),
          /** Marks the single wide image on the About page. */
          wide: z.boolean().default(false),
        }),
      )
      .default([]),
    /** Optional call to action rendered at the end of the page. */
    cta: z
      .object({
        label: z.string(),
        href: z.string(),
      })
      .optional(),
    /**
     * EOPYY reimbursement figures. Present on the EOPYY page only, and consumed by the home
     * page card and (from STEP-09) structured data. The same numbers also appear in that
     * page's prose; `tests/unit/content-integrity.test.ts` asserts the two cannot drift.
     */
    subsidy: z
      .object({
        adultAmount: z.number().int().positive(),
        childAmount: z.number().int().positive(),
        childMaxAge: z.number().int().positive(),
        renewalYears: z.number().int().positive(),
      })
      .optional(),
  }),
});

export const collections = {
  'hearing-types': hearingTypes,
  'hearing-models': hearingModels,
  faqs,
  providers,
  pages,
};

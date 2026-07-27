import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
// `z` is imported from `astro/zod` rather than `astro:content`, whose re-export Astro 7 has
// deprecated. Both resolve to the same Zod v4 namespace.
import { z } from 'astro/zod';

/**
 * Content collections for the site.
 *
 * Format rule: YAML for pure structured data, MDX where the text is genuinely prose.
 * The entry id is always the filename without its extension, and for `hearing-types` that id
 * is also the public URL segment (`/akoustika/{id}`).
 *
 * The prose globs accept `.md` as well as `.mdx`, deliberately. An mdx-only glob would mean a stray
 * `.md` file is not a failing entry but an invisible one, surfacing as a missing page rather than
 * an error. The permissive glob plus `content-integrity.test.ts`, which requires every file in a
 * collection directory to be read and every prose body to be `.mdx`, fails loudly and by name
 * instead.
 *
 * Images live in `src/assets/images/` and are referenced with `image()`, which hands the template
 * an `ImageMetadata` object — dimensions included, so nothing renders without a known aspect
 * ratio. Paths are relative to the entry file, and every collection sits one level under
 * `src/content/`, so they all start `../../assets/images/`.
 *
 * `imageSource` / `imageSources` survive alongside them. They record the URL a photo originally
 * came from, kept as provenance for the maintainer; nothing renders them, and the site no longer
 * fetches anything from those hosts.
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
  schema: ({ image }) =>
    z.object({
      /** Full title used on the listing card, e.g. "Ενδοκαναλικά – CIC (Completely in Canal)". */
      title: z.string(),
      /** Greek name alone, used as the category page heading, e.g. "Ενδοκαναλικά". */
      shortTitle: z.string(),
      /** Latin abbreviation shown beside the heading, e.g. "CIC". */
      latinAbbreviation: z.string(),
      /** Listing-card body copy. */
      description: z.string(),
      seo,
      /**
       * All four categories illustrate themselves with the photo of one of their models, exactly
       * as the live site does, so these point at files in `images/hearing/`.
       */
      image: image(),
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
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      /**
       * The owning category. `reference()` only shapes the value — it does not verify that the
       * entry exists — so `src/lib/content/collections.ts` asserts resolution at build time.
       */
      type: reference('hearing-types'),
      description: z.string(),
      /** One photo per model. The filename matches this entry's id. */
      image: image(),
      imageAlt: z.string(),
      imageSources: z.array(z.url()).min(1),
      /** Display order within the category, ascending. */
      order: z.number().int().positive(),
      /** Shown in the "Τα ακουστικά μας" section on the home page. */
      featured: z.boolean().default(false),
    }),
});

/** Frequently asked questions. The answer is the MDX body. */
const faqs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    order: z.number().int().positive(),
  }),
});

/** Hearing-aid manufacturers the business works with. */
const providers = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/providers' }),
  schema: ({ image }) =>
    z.object({
      /** Stored in proper case; uppercasing is presentation and belongs in CSS. */
      name: z.string(),
      description: z.string(),
      features: z.array(z.string()).min(1),
      logo: image(),
      logoAlt: z.string(),
      website: z.url(),
      order: z.number().int().positive(),
    }),
});

/** Long-form editorial pages. The prose is the MDX body. */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: ({ image }) =>
    z.object({
      /** Page heading. */
      title: z.string(),
      description: z.string(),
      seo,
      /**
       * Opening paragraphs that a template may place outside the flow of the body, one string per
       * paragraph. The About page needs this: its introduction sits beside the photo grid on
       * production while the rest of the prose runs full width below, and a single rendered body
       * cannot be split in two.
       *
       * Optional, so a page that reads as one continuous document leaves it empty and puts
       * everything in the Markdown body.
       */
      lead: z.array(z.string()).default([]),
      /** Images belonging to the page. The template decides how they are arranged. */
      images: z
        .array(
          z.object({
            image: image(),
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

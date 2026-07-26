import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { hearingTypePath, ROUTES } from '@/data/routes';

/**
 * Integrity checks that read the content files straight off disk.
 *
 * These complement rather than duplicate `astro check`, which validates each entry against its
 * schema in isolation. The gaps this file covers are the ones a schema cannot see: references
 * between collections, ids that must stay usable as URL segments, figures repeated between
 * frontmatter and prose, and text corruption carried over from the legacy data.
 */

const CONTENT_ROOT = 'src/content';

/** Every id must work unchanged as a URL segment — models may become product pages later. */
const URL_SAFE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface Entry {
  id: string;
  file: string;
  data: Record<string, unknown>;
  body: string;
}

function readCollection(collection: string, extension: '.yaml' | '.md'): Entry[] {
  const directory = join(CONTENT_ROOT, collection);

  return readdirSync(directory)
    .filter((file) => extname(file) === extension)
    .map((file) => {
      const path = join(directory, file);
      const raw = readFileSync(path, 'utf8');

      if (extension === '.yaml') {
        return {
          id: basename(file, extension),
          file: path,
          data: Bun.YAML.parse(raw) as Record<string, unknown>,
          body: '',
        };
      }

      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!match) {
        throw new Error(`${path} has no frontmatter block.`);
      }
      return {
        id: basename(file, extension),
        file: path,
        data: Bun.YAML.parse(match[1] as string) as Record<string, unknown>,
        body: match[2] as string,
      };
    });
}

const hearingTypes = readCollection('hearing-types', '.yaml');
const hearingModels = readCollection('hearing-models', '.yaml');
const providers = readCollection('providers', '.yaml');
const faqs = readCollection('faqs', '.md');
const pages = readCollection('pages', '.md');

/**
 * `globallyOrdered` marks the collections whose `order` is unique across the whole collection.
 * Hearing models are excluded because their order is scoped to their category — that is
 * checked per type in "model order is contiguous from 1 within each type" below.
 */
const collections = [
  { name: 'hearing-types', entries: hearingTypes, globallyOrdered: true },
  { name: 'hearing-models', entries: hearingModels, globallyOrdered: false },
  { name: 'providers', entries: providers, globallyOrdered: true },
  { name: 'faqs', entries: faqs, globallyOrdered: true },
  { name: 'pages', entries: pages, globallyOrdered: false },
];

describe('collection shape', () => {
  test('every collection has entries', () => {
    for (const { name, entries } of collections) {
      expect(entries.length, `${name} is empty`).toBeGreaterThan(0);
    }
  });

  test('the migrated entry counts match the legacy site', () => {
    expect(hearingTypes).toHaveLength(4);
    expect(hearingModels).toHaveLength(13);
    expect(faqs).toHaveLength(9);
    expect(providers).toHaveLength(4);
  });

  test('every id is lowercase, hyphenated and safe to use in a URL', () => {
    for (const { name, entries } of collections) {
      for (const entry of entries) {
        expect(URL_SAFE_ID.test(entry.id), `${name}/${entry.id} is not a safe URL segment`).toBe(
          true,
        );
      }
    }
  });

  test('order values are unique within each ordered collection', () => {
    for (const { name, entries, globallyOrdered } of collections) {
      if (!globallyOrdered) continue;

      const orders = entries.map((entry) => entry.data.order as number);
      expect(new Set(orders).size, `${name} has duplicate order values`).toBe(orders.length);
    }
  });
});

describe('references between collections', () => {
  const knownTypes = new Set(hearingTypes.map((type) => type.id));

  test('every model points at a hearing type that exists', () => {
    for (const model of hearingModels) {
      expect(knownTypes, `${model.file} references an unknown type`).toContain(
        model.data.type as string,
      );
    }
  });

  test('every hearing type has at least one model', () => {
    for (const type of hearingTypes) {
      const owned = hearingModels.filter((model) => model.data.type === type.id);
      expect(owned.length, `${type.id} has no models`).toBeGreaterThan(0);
    }
  });

  test('model order is contiguous from 1 within each type', () => {
    for (const type of hearingTypes) {
      const orders = hearingModels
        .filter((model) => model.data.type === type.id)
        .map((model) => model.data.order as number)
        .sort((a, b) => a - b);

      expect(orders, `${type.id} model order is not 1..n`).toEqual(
        orders.map((_, index) => index + 1),
      );
    }
  });

  test('exactly one model per hearing type is featured on the home page', () => {
    for (const type of hearingTypes) {
      const featured = hearingModels.filter(
        (model) => model.data.type === type.id && model.data.featured === true,
      );
      expect(featured, `${type.id} should have exactly one featured model`).toHaveLength(1);
    }
  });

  /**
   * "Metadata unique" is a STEP-06 acceptance criterion, and the five catalogue routes take their
   * titles and descriptions straight from these entries. Catching a duplicate here names the file;
   * catching it in the browser only says two pages agree.
   */
  test('every category has its own title and description', () => {
    const seo = hearingTypes.map((type) => type.data.seo as { title: string; description: string });

    for (const [index, entry] of seo.entries()) {
      expect(
        entry?.title?.trim().length,
        `${hearingTypes[index]?.file} has no seo title`,
      ).toBeGreaterThan(0);
      expect(
        entry?.description?.trim().length,
        `${hearingTypes[index]?.file} has no seo description`,
      ).toBeGreaterThan(0);
    }

    expect(new Set(seo.map((entry) => entry.title)).size, 'two categories share a title').toBe(
      seo.length,
    );
    expect(
      new Set(seo.map((entry) => entry.description)).size,
      'two categories share a description',
    ).toBe(seo.length);
  });

  /** The category page builds its heading as `{shortTitle} ({latinAbbreviation})`. */
  test('every category can name itself the way its page heading does', () => {
    for (const type of hearingTypes) {
      for (const key of ['shortTitle', 'latinAbbreviation', 'description']) {
        expect(
          (type.data[key] as string)?.trim().length,
          `${type.file} has no ${key}`,
        ).toBeGreaterThan(0);
      }
    }

    const headings = hearingTypes.map(
      (type) => `${type.data.shortTitle} (${type.data.latinAbbreviation})`,
    );
    expect(new Set(headings).size, 'two categories would render the same heading').toBe(
      headings.length,
    );
  });

  /**
   * The catalogue rows exist to carry these descriptions. Each one was expanded from a single
   * migrated sentence to the model's actual specifications during the STEP-06 review corrections,
   * and the shortest of the thirteen is 227 characters. A floor of 200 catches a regression to one
   * sentence without pinning any particular wording.
   */
  test('every model description carries more than one sentence of detail', () => {
    for (const model of hearingModels) {
      const description = (model.data.description as string).replace(/\s+/g, ' ').trim();

      expect(
        description.length,
        `${model.file} is back to a single sentence (${description.length} characters)`,
      ).toBeGreaterThanOrEqual(200);
    }
  });

  /**
   * Two platform claims were wrong before the corrections round: Silk Charge&Go IX was described as
   * Augmented Xperience when it is Integrated Xperience, and Insio Charge&Go as Signia NX when it is
   * Augmented Xperience. Both are easy to reintroduce by copying a neighbouring entry, so the two
   * names are pinned to the entries that may hold them.
   */
  test('no model names a platform it is not built on', () => {
    /** Models Signia publishes as Augmented Xperience. Everything else may not claim it. */
    const augmented = new Set(['insio-charge-go', 'pure-312']);

    for (const model of hearingModels) {
      const description = model.data.description as string;

      expect(description, `${model.file} names the retired Signia NX platform`).not.toMatch(
        /Signia NX/,
      );

      if (!augmented.has(model.id)) {
        expect(
          description,
          `${model.file} claims Augmented Xperience; only ${[...augmented].join(' and ')} are`,
        ).not.toMatch(/Augmented Xperience/);
      }
    }
  });

  /**
   * Signia states that Silk Charge&Go IX and Insio IX have no Bluetooth connectivity, and publishes
   * nothing about it for the Orion essentials line. All three said otherwise before the corrections
   * round; none may say so again.
   */
  test('no model without Bluetooth claims to stream audio', () => {
    const cannotStream = ['silk-charge-go', 'insio-cic-mayro', 'orion-charge-go'];

    for (const id of cannotStream) {
      const model = hearingModels.find((entry) => entry.id === id);
      expect(model, `${id} is missing from the collection`).toBeDefined();

      expect(
        model?.data.description as string,
        `${id} claims streaming or Bluetooth, which no source supports for it`,
      ).not.toMatch(/streaming|Bluetooth/i);
    }
  });

  test('every hearing type has a matching route', () => {
    const knownRoutes = new Set<string>(Object.values(ROUTES));

    for (const type of hearingTypes) {
      expect(knownRoutes, `no route for hearing type ${type.id}`).toContain(
        hearingTypePath(type.id),
      );
    }
  });
});

describe('image sources', () => {
  /**
   * `imageSource` / `imageSources` are a provenance record: the URL a photo originally came
   * from. Since STEP-03 they are never fetched and never rendered — the photo itself is a local
   * file in `image`. `tests/unit/assets.test.ts` covers those files.
   */
  const sources = [
    ...hearingTypes.map((type) => ({ file: type.file, url: type.data.imageSource as string })),
    ...hearingModels.flatMap((model) =>
      (model.data.imageSources as string[]).map((url) => ({ file: model.file, url })),
    ),
  ];

  test('every image source is an absolute URL', () => {
    for (const { file, url } of sources) {
      expect(() => new URL(url), `${file} has an unparsable image source`).not.toThrow();
    }
  });

  test('the one plain-http source is provenance only, and there is still only one', () => {
    // The live site fails Lighthouse's mixed-content check because of this URL. Nothing here
    // requests it. If a second one ever appears, this fails rather than shipping quietly.
    const insecure = sources.filter(({ url }) => url.startsWith('http://'));

    expect(insecure).toHaveLength(1);
    expect(insecure[0]?.file).toContain('hearing-types');
    expect(insecure[0]?.file).toContain('cic');
  });

  test('no rendered image field holds a URL', () => {
    const rendered = [
      ...hearingTypes.map((type) => ({ file: type.file, value: type.data.image })),
      ...hearingModels.map((model) => ({ file: model.file, value: model.data.image })),
      ...providers.map((provider) => ({ file: provider.file, value: provider.data.logo })),
      ...pages.flatMap((page) =>
        ((page.data.images ?? []) as Array<{ image: string }>).map((entry) => ({
          file: page.file,
          value: entry.image,
        })),
      ),
    ];

    expect(rendered.length, 'no entry declares an image').toBeGreaterThan(0);
    for (const { file, value } of rendered) {
      expect(typeof value, `${file} has a non-string image path`).toBe('string');
      expect(value as string, `${file} points its image at a remote URL`).toMatch(
        /^\.\.\/\.\.\/assets\/images\//,
      );
    }
  });
});

describe('long-form pages', () => {
  test('the EOPYY figures in frontmatter also appear in the prose', () => {
    const eopyy = pages.find((page) => page.id === 'eopyy');
    expect(eopyy, 'src/content/pages/eopyy.md is missing').toBeDefined();

    const subsidy = eopyy?.data.subsidy as Record<string, number> | undefined;
    expect(subsidy, 'eopyy.md is missing its subsidy frontmatter').toBeDefined();

    const body = eopyy?.body ?? '';
    expect(body, 'the adult amount is not stated in the prose').toContain(
      `${subsidy?.adultAmount}€`,
    );
    expect(body, 'the child amount is not stated in the prose').toContain(
      `${subsidy?.childAmount}€`,
    );
    expect(body, 'the child age limit is not stated in the prose').toContain(
      `${subsidy?.childMaxAge} ετών`,
    );
    expect(body, 'the renewal period is not stated in the prose').toContain(
      `${subsidy?.renewalYears} έτη`,
    );
  });

  test('every page has a non-empty body', () => {
    for (const page of pages) {
      expect(page.body.trim().length, `${page.file} has an empty body`).toBeGreaterThan(0);
    }
  });

  test('every FAQ has a non-empty answer', () => {
    for (const faq of faqs) {
      expect(faq.body.trim().length, `${faq.file} has an empty answer`).toBeGreaterThan(0);
    }
  });
});

describe('text quality', () => {
  const allFiles = collections.flatMap(({ entries }) => entries.map((entry) => entry.file));

  test('no file uses a non-breaking hyphen', () => {
    // The legacy model data used U+2011 inside broken tokens such as "12‑kanaλους".
    for (const file of allFiles) {
      const raw = readFileSync(file, 'utf8');
      expect(raw.includes('‑'), `${file} contains a non-breaking hyphen`).toBe(false);
    }
  });

  test('no visitor-facing copy uses an em dash', () => {
    // A maintainer instruction, given during STEP-07 planning: em dashes read as machine-written
    // Greek. The en dash is deliberately still allowed, because the client's own copy uses it for
    // ranges and title separators ("4–6 έτη", "ΕΟΠΥΥ – Συμμετοχή"), and stripping those would be
    // editing client text to satisfy a style rule about a different character.
    //
    // Comments are stripped before the check. The rule is about text a visitor reads, and the
    // source comments in this repository have used em dashes since STEP-01; rewriting thirty of
    // them across already-accepted files would be a large diff that improves nothing on screen.
    //
    // `src/data` is checked alongside the collections because half the site's Greek lives there:
    // the home page, the catalogue bands and the informational page strings are all TypeScript.
    const dataFiles = readdirSync('src/data')
      .filter((file) => extname(file) === '.ts')
      .map((file) => join('src/data', file));

    /** Drops `#` lines from YAML and frontmatter, and `//` and block comments from TypeScript. */
    function stripComments(source: string, file: string): string {
      if (extname(file) === '.ts') {
        return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      }
      return source.replace(/^\s*#.*$/gm, '');
    }

    for (const file of [...allFiles, ...dataFiles]) {
      const copy = stripComments(readFileSync(file, 'utf8'), file);
      expect(copy.includes('—'), `${file} contains an em dash in visitor-facing copy`).toBe(false);
    }
  });

  test('no word mixes Latin and Greek letters', () => {
    // Catches mojibake like the legacy "kanaλους", and part-Greek abbreviations such as the
    // legacy "ΙΙC" (Greek Ι + Greek Ι + Latin C). Abbreviations spelled *entirely* in Greek
    // homoglyphs look identical here, so they are covered by the next test instead.
    const word = /[A-Za-zͰ-Ͽἀ-῿]+/g;

    for (const file of allFiles) {
      const raw = readFileSync(file, 'utf8');

      for (const token of raw.match(word) ?? []) {
        const mixed = /[A-Za-z]/.test(token) && /[Ͱ-Ͽἀ-῿]/.test(token);
        expect(mixed, `${file} contains the mixed-script word "${token}"`).toBe(false);
      }
    }
  });

  test('Latin abbreviations are not spelled with Greek homoglyphs', () => {
    // The legacy data wrote "BTE" as "ΒΤΕ" — Greek beta, tau and epsilon. It is visually
    // identical, but screen readers announce it as Greek letters and search engines do not
    // match it to "BTE". Nothing in the mixed-script test can see it, because every character
    // really is Greek. So each Latin abbreviation the site uses is rebuilt from homoglyphs and
    // that spelling is asserted absent.
    const homoglyphs: Record<string, string> = {
      A: 'Α',
      B: 'Β',
      E: 'Ε',
      H: 'Η',
      I: 'Ι',
      K: 'Κ',
      M: 'Μ',
      N: 'Ν',
      O: 'Ο',
      P: 'Ρ',
      T: 'Τ',
      X: 'Χ',
      Y: 'Υ',
      Z: 'Ζ',
    };
    const abbreviations = ['BTE', 'IX', 'IP', 'AI', 'HP', 'MPO'];

    for (const abbreviation of abbreviations) {
      const greek = [...abbreviation].map((letter) => homoglyphs[letter] ?? letter).join('');
      // Only meaningful when every character actually has a homoglyph.
      if (greek === abbreviation) continue;

      for (const file of allFiles) {
        const raw = readFileSync(file, 'utf8');
        expect(raw.includes(greek), `${file} spells "${abbreviation}" with Greek homoglyphs`).toBe(
          false,
        );
      }
    }
  });

  test('no string value has leading or trailing whitespace', () => {
    for (const { entries } of collections) {
      for (const entry of entries) {
        for (const [key, value] of flatten(entry.data)) {
          expect(value, `${entry.file} -> ${key} is padded with whitespace`).toBe(value.trim());
        }
      }
    }
  });

  test('no string value contains a double space or a space before punctuation', () => {
    for (const { entries } of collections) {
      for (const entry of entries) {
        for (const [key, value] of flatten(entry.data)) {
          expect(/ {2}/.test(value), `${entry.file} -> ${key} has a double space`).toBe(false);
          expect(
            /\s[.,;]/.test(value),
            `${entry.file} -> ${key} has a space before punctuation`,
          ).toBe(false);
        }
      }
    }
  });

  test('no Greek prose is quoted with ASCII apostrophes', () => {
    for (const { entries } of collections) {
      for (const entry of entries) {
        for (const [key, value] of flatten(entry.data)) {
          const asciiQuoted = /'[^']*[Ͱ-Ͽ][^']*'/.test(value);
          expect(asciiQuoted, `${entry.file} -> ${key} uses ASCII quotes around Greek`).toBe(false);
        }
      }
    }
  });
});

/** Yields every string leaf in an entry's data as `[path, value]`. */
function flatten(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') {
    return [[path || '.', value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flatten(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      flatten(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

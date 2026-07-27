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

/** Prose bodies. Both are accepted so a rename between them cannot quietly change what is read. */
const BODY_EXTENSIONS = ['.md', '.mdx'];

/**
 * Reads a collection off disk.
 *
 * `kind` is the *sort* of file rather than a literal extension, and that distinction is
 * load-bearing. This used to take an exact extension and filter on equality, which meant STEP-08's
 * rename of the prose bodies from `.md` to `.mdx` would have made `readCollection('faqs', '.md')`
 * return an empty array.
 *
 * `collection shape › every collection has entries` would have caught that, so the failure would
 * have been loud rather than silent. What it would *not* have caught is a **partial** rename: move
 * ten of the fourteen FAQ files and the collection is still non-empty, so every check below quietly
 * runs over a subset. That is what the expected-count assertions further down close.
 */
function readCollection(collection: string, kind: 'yaml' | 'body'): Entry[] {
  const directory = join(CONTENT_ROOT, collection);
  const wanted = kind === 'yaml' ? ['.yaml'] : BODY_EXTENSIONS;

  return readdirSync(directory)
    .filter((file) => wanted.includes(extname(file)))
    .map((file) => {
      const path = join(directory, file);
      const raw = readFileSync(path, 'utf8');
      const extension = extname(file);

      if (kind === 'yaml') {
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

const hearingTypes = readCollection('hearing-types', 'yaml');
const hearingModels = readCollection('hearing-models', 'yaml');
const providers = readCollection('providers', 'yaml');
const faqs = readCollection('faqs', 'body');
const pages = readCollection('pages', 'body');

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

  test('every file on disk is actually read as an entry', () => {
    // The guard above only proves a collection is not *empty*. This one proves nothing is being
    // skipped: a file whose extension no reader recognises is not a failing entry, it is an
    // invisible one, and it surfaces as a missing page rather than as an error.
    //
    // The same reasoning is why `content.config.ts` globs `**/*.{md,mdx}` rather than `**/*.mdx`.
    // A permissive glob plus this assertion fails loudly and by name; a strict glob fails silently.
    for (const { name, entries } of collections) {
      const onDisk = readdirSync(join(CONTENT_ROOT, name)).filter((file) => !file.startsWith('.'));

      const unread = onDisk.filter(
        (file) =>
          !entries.some(
            (entry) => entry.file.endsWith(`/${file}`) || entry.file.endsWith(`\\${file}`),
          ),
      );

      expect(unread, `${name} has files that no reader picks up: ${unread.join(', ')}`).toEqual([]);
      expect(entries.length, `${name} entry count does not match its directory`).toBe(
        onDisk.length,
      );
    }
  });

  test('every prose body is .mdx', () => {
    // MDX is the site's one prose format, so a `.md` file is a half-converted entry rather than a
    // choice. The glob in `content.config.ts` still accepts both on purpose: it means such a file
    // renders, and then fails here by name, instead of silently not being a page at all.
    for (const { name, entries } of collections) {
      for (const entry of entries) {
        if (!entry.body) continue;
        expect(extname(entry.file), `${name}/${entry.id} is not .mdx`).toBe('.mdx');
      }
    }
  });

  test('the migrated entry counts match the legacy site', () => {
    expect(hearingTypes).toHaveLength(4);
    expect(hearingModels).toHaveLength(13);
    expect(providers).toHaveLength(4);
  });

  test("the legacy site's nine questions are all still present", () => {
    // STEP-07 added five generic questions on top of the client's nine. The count is therefore no
    // longer a parity check, but the nine themselves must never quietly disappear, so they are
    // named here. Adding a question is expected; removing one of these is not.
    const legacy = [
      'how-they-work',
      'lifespan',
      'trial',
      'eopyy-subsidy',
      'process-duration',
      'warranty',
      'online-support',
      'repairs',
      'after-hours-appointments',
    ];

    const ids = new Set(faqs.map((faq) => faq.id));
    for (const id of legacy) {
      expect(ids.has(id), `the legacy FAQ "${id}" is missing`).toBe(true);
    }

    // The nine are also the first nine on the page: they keep `order` 1 to 9, and anything added
    // since sorts below them.
    const ordered = [...faqs].sort((a, b) => (a.data.order as number) - (b.data.order as number));
    expect(
      ordered
        .slice(0, 9)
        .map((faq) => faq.id)
        .sort(),
    ).toEqual([...legacy].sort());
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
  test('the EOPYY prose reads its figures from frontmatter rather than restating them', () => {
    // This used to assert that the numbers written in the prose matched the numbers in
    // frontmatter, which is a test standing guard over a duplication. Now the prose interpolates
    // the frontmatter, so there is one source and nothing left to drift, and what is worth
    // checking is that it stays that way.
    //
    // The rendered figures are covered separately, in the browser, on both pages that show them:
    // `home.spec.ts` for the card and `informational.spec.ts` for this page.
    const eopyy = pages.find((page) => page.id === 'eopyy');
    expect(eopyy, 'src/content/pages/eopyy.mdx is missing').toBeDefined();

    const subsidy = eopyy?.data.subsidy as Record<string, number> | undefined;
    expect(subsidy, 'eopyy.mdx is missing its subsidy frontmatter').toBeDefined();

    const body = eopyy?.body ?? '';

    for (const field of ['adultAmount', 'childAmount', 'childMaxAge', 'renewalYears']) {
      expect(body, `the prose does not interpolate subsidy.${field}`).toContain(
        `{frontmatter.subsidy.${field}}`,
      );
    }

    // A literal amount in the prose means someone has written a number back in beside the
    // interpolation, which is the drift this arrangement exists to prevent.
    for (const amount of [subsidy?.adultAmount, subsidy?.childAmount]) {
      expect(
        body,
        `the prose hard-codes ${amount}€ instead of reading it from frontmatter`,
      ).not.toContain(`${amount}€`);
    }
  });

  test('the EOPYY page still explains the documents and the steps', () => {
    const body = pages.find((page) => page.id === 'eopyy')?.body ?? '';

    expect(body, 'the documents section is missing').toContain('## Τι δικαιολογητικά χρειάζονται');
    expect(body, 'the process section is missing').toContain('## Πώς γίνεται η διαδικασία');

    // The hedge is the point of the documents section, not decoration. These are external rules
    // that change, and the page must not read as a guarantee of what EOPYY will accept.
    expect(body, 'the documents section no longer hedges').toContain('μπορεί να αλλάξουν');
  });

  /**
   * The privacy notice.
   *
   * These were written during STEP-08's corrections round, and the first of them closes a gap
   * between what the previous `result.md` *claimed* and what existed: it said a test enforced the
   * interpolation of the shop's details, and no such test had been written.
   *
   * The rest pin the sections that make the notice a real Article 13 disclosure rather than a
   * paragraph of goodwill. Each is here because leaving it out is a specific, nameable failure.
   */
  const privacy = () => pages.find((page) => page.id === 'privacy');

  test('the privacy notice reads the shop details rather than restating them', () => {
    const body = privacy()?.body ?? '';
    expect(body.length, 'the privacy page is missing').toBeGreaterThan(0);

    // The whole reason this page is `.mdx`: the legacy site kept three copies of these and they had
    // drifted apart by the time anybody looked.
    expect(body).toContain('{BUSINESS.telephone.display}');
    expect(body).toContain('{BUSINESS.email}');

    expect(body, 'the shop telephone is hard-coded').not.toContain('210 612 9896');
    expect(body, 'the shop email is hard-coded').not.toContain('akoustika.passalis@gmail.com');
    expect(body, 'the street is hard-coded').not.toContain('Δολιανής 74');
  });

  test('the privacy notice names its controller', () => {
    // Article 13(1)(a). A notice that never says who is responsible fails at its first job.
    expect(privacy()?.body ?? '').toContain('{BUSINESS.legalEntityName}');
  });

  test('the privacy notice discloses what is logged automatically', () => {
    // The endpoint hashes and stores the visitor's IP for rate limiting, and Vercel logs it as
    // host. The first version of this notice did not mention either, which made it a notice that
    // described less than the code did.
    const body = privacy()?.body ?? '';

    expect(body, 'automatic logging is not disclosed').toContain('Τι καταγράφεται αυτόματα');
    expect(body).toContain('IP');
    expect(body, 'the host is not named').toContain('Vercel');
  });

  test('the privacy notice covers every disclosure Article 13 asks for', () => {
    const body = privacy()?.body ?? '';

    const required: Record<string, string> = {
      'Υπεύθυνος επεξεργασίας': 'controller identity, Art. 13(1)(a)',
      'Νομική βάση': 'legal basis, Art. 13(1)(c)',
      'Ποιοι άλλοι τα βλέπουν': 'recipients, Art. 13(1)(e)',
      'τυποποιημένες συμβατικές ρήτρες': 'third-country safeguards, Art. 13(1)(f)',
      'Πόσο καιρό τα κρατάμε': 'retention, Art. 13(2)(a)',
      'Τα δικαιώματά σας': 'rights, Art. 13(2)(b)',
      'Αρχή Προστασίας Δεδομένων': 'the supervisory authority, Art. 13(2)(d)',
      'Είστε υποχρεωμένοι': 'whether provision is obligatory, Art. 13(2)(e)',
      'Αυτοματοποιημένες αποφάσεις': 'automated decisions, Art. 13(2)(f)',
      Ασφάλεια: 'security measures',
      Ανήλικοι: 'children',
    };

    for (const [heading, why] of Object.entries(required)) {
      expect(body.includes(heading), `the notice is missing ${why}`).toBe(true);
    }
  });

  test('the privacy notice tells people not to send medical detail', () => {
    // This is a hearing-aid shop. A free-text message is an obvious place to describe a condition,
    // which is an Article 9 special category, and asking for less is better than promising more.
    const body = privacy()?.body ?? '';

    expect(body).toContain('ιατρικά στοιχεία');
    expect(body, 'Article 9 is not named').toContain('άρθρου 9');
  });

  test('the privacy notice states a retention period rather than a feeling', () => {
    // "As long as necessary" is the phrasing that makes a notice look unserious. A reader should
    // be able to work out when their message goes away.
    expect(privacy()?.body ?? '').toContain('έξι μήνες');
  });

  test("the about page's introduction survived the move into `lead`", () => {
    // STEP-07 moved these two paragraphs out of the Markdown body and into frontmatter so the
    // template could set them beside the photo grid. They are the client's words and the move was
    // supposed to be lossless, so they are pinned here. Whitespace is normalised because YAML
    // folding and Markdown wrapping break lines in different places; every other character must
    // match.
    const original = [
      'Η Πασσαλής Ακουστικά Βαρηκοΐας είναι εδώ για να βελτιώσει την καθημερινότητά σας. Η ομάδα μας προσφέρει σύγχρονες λύσεις και φροντίδα με σεβασμό και επαγγελματισμό.',
      'Εμπιστευθείτε τους ειδικούς μας για να βρείτε το κατάλληλο ακουστικό βαρηκοΐας, προσαρμοσμένο στις δικές σας ανάγκες.',
    ];

    const about = pages.find((page) => page.id === 'about');
    const lead = (about?.data.lead as string[] | undefined) ?? [];
    const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

    expect(lead.length, 'about.mdx has no lead paragraphs').toBeGreaterThanOrEqual(original.length);
    for (const [index, paragraph] of original.entries()) {
      expect(squash(lead[index] ?? ''), `about.mdx lead paragraph ${index + 1} was altered`).toBe(
        paragraph,
      );
    }
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

  test("the client's original FAQ answers are still there word for word", () => {
    // STEP-07 added a second sentence to three of these. The addition is allowed; editing what was
    // already there is not, so the original sentence of each is pinned. The other six are pinned
    // whole for the same reason.
    const original: Record<string, string> = {
      'how-they-work':
        'Τα ακουστικά ενισχύουν τους ήχους που χάνετε και τα προσαρμόζουμε ανάλογα με το πρόβλημά σας και τις συνθήκες του περιβάλλοντος.',
      lifespan: 'Έχουν διάρκεια περίπου 4–6 έτη, ανάλογα με τη χρήση και τη φροντίδα τους.',
      trial:
        'Ναι! Μπορείτε να τα δοκιμάσετε εδώ στο κατάστημά μας και να πειραματιστείτε με τις ρυθμίσεις.',
      'eopyy-subsidy': 'Ναι, καλύπτονται μέσω ΕΟΠΥΥ, εφόσον έχετε σχετική γνωμάτευση.',
      'process-duration': 'Συνήθως 1–2 επισκέψεις για μετρήσεις και προσαρμογή.',
      warranty: 'Ναι, παρέχουμε διετή εγγύηση και συντήρηση για 3 χρόνια.',
      'online-support': 'Μπορείτε πάντα να επικοινωνείτε τηλεφωνικά ή μέσω email για βοήθεια.',
      repairs: 'Ναι, προσφέρουμε υπηρεσίες επισκευής στο κατάστημα ή κατόπιν παραγγελίας.',
      'after-hours-appointments': 'Ναι, εξυπηρετούμε εκτός ωραρίου με ραντεβού για ευκολία.',
    };

    for (const [id, sentence] of Object.entries(original)) {
      const faq = faqs.find((entry) => entry.id === id);
      expect(faq, `the FAQ "${id}" is missing`).toBeDefined();
      expect(
        (faq?.body ?? '').replace(/\s+/g, ' '),
        `the original answer in ${id}.mdx was altered`,
      ).toContain(sentence);
    }
  });

  test('every link in a FAQ answer points at a route that exists', () => {
    // The answers can carry Markdown links now, and one does. A link to a route that has not been
    // built is a 404 a reader reaches from the page most likely to be their first stop.
    const known = new Set<string>(Object.values(ROUTES));
    let checked = 0;

    for (const faq of faqs) {
      for (const [, href] of faq.body.matchAll(/\]\((\/[^)]*)\)/g)) {
        checked += 1;
        expect(known.has(href as string), `${faq.file} links to the unknown route "${href}"`).toBe(
          true,
        );
      }
    }

    // Without this the loop above passes by finding nothing, which is how a link check quietly
    // stops being one.
    expect(checked, 'no FAQ answer contains a link, so nothing was checked').toBeGreaterThan(0);
  });

  test('every provider description carries its sourced closing sentence', () => {
    // Added in STEP-07 from WS Audiology's own brand pages. Each is a checkable corporate fact
    // rather than marketing, and the Siemens one is load-bearing: it explains why two cards on
    // /synergates/paroxoi link to the same website.
    const closing: Record<string, string> = {
      signia: 'Ανήκει στον όμιλο WS Audiology',
      'am-hearing': 'από το 1987 ανήκει στον όμιλο WS Audiology',
      rexton: 'από το 1955',
      siemens: 'παραπέμπουν στον ίδιο ιστότοπο',
    };

    for (const [id, sentence] of Object.entries(closing)) {
      const provider = providers.find((entry) => entry.id === id);
      expect(provider, `the provider "${id}" is missing`).toBeDefined();
      expect(
        ((provider?.data.description as string | undefined) ?? '').replace(/\s+/g, ' '),
        `${id}.yaml lost its sourced sentence`,
      ).toContain(sentence);
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

  test('no visitor-facing copy uses a machine-written phrase', () => {
    // The same maintainer instruction as the em dash rule, widened during STEP-08 while writing the
    // privacy notice. A privacy page is the easiest thing on a site to fill with translated
    // boilerplate, and boilerplate is what this catches.
    //
    // Every entry is a phrase that reads as filler in Greek: it announces that something is about
    // to be said instead of saying it. None of them appears in the client's own copy, which is the
    // test of whether a rule like this is safe to apply to a site that already has text on it.
    const tells = [
      'εν κατακλείδι',
      'αξίζει να σημειωθεί',
      'αξίζει να αναφερθεί',
      'είναι σημαντικό να τονίσουμε',
      'είναι σημαντικό να σημειωθεί',
      'στον σημερινό ψηφιακό κόσμο',
      'στη σημερινή εποχή',
      'στο σημερινό τοπίο',
      'δεν είναι απλώς',
      'ας εμβαθύνουμε',
      'σε αυτό το άρθρο θα',
      'συμπερασματικά',
      'με λίγα λόγια',
      'κάνει τη διαφορά',
      'μια νέα εποχή',
      'ξεκλειδώνει',
      'βουτιά στον κόσμο',
    ];

    const dataFiles = readdirSync('src/data')
      .filter((file) => extname(file) === '.ts')
      .map((file) => join('src/data', file));

    function stripComments(source: string, file: string): string {
      if (extname(file) === '.ts') {
        return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      }
      return source.replace(/^\s*#.*$/gm, '');
    }

    for (const file of [...allFiles, ...dataFiles]) {
      const copy = stripComments(readFileSync(file, 'utf8'), file).toLowerCase();

      for (const tell of tells) {
        expect(copy.includes(tell), `${file} contains the filler phrase "${tell}"`).toBe(false);
      }
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

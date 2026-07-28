import { describe, expect, test } from 'bun:test';
import { BUSINESS } from '@/data/business';
import { ROUTES } from '@/data/routes';
import { breadcrumbTrail } from '@/lib/navigation/breadcrumbs';
import { toPlainText } from '@/lib/seo/markdown';
import {
  aboutPage,
  breadcrumbList,
  contactPage,
  faqPage,
  hearingAidStore,
  webSite,
} from '@/lib/seo/schema';
import { buildTitle, TITLE_SUFFIX } from '@/lib/seo/title';
import { absoluteUrl } from '@/lib/seo/urls';

describe('title template', () => {
  test('the suffix carries the brand and the locality once each', () => {
    expect(TITLE_SUFFIX).toContain(BUSINESS.name);
    expect(TITLE_SUFFIX).toContain(BUSINESS.address.locality);
  });

  test('a page title gains the suffix', () => {
    expect(buildTitle('Επικοινωνία')).toBe(`Επικοινωνία | ${TITLE_SUFFIX}`);
  });

  test('the home page opts out and renders its own title verbatim', () => {
    const home = 'Ακουστικά Βαρηκοΐας στο Μαρούσι – Πασσαλής Ακουστικά';
    expect(buildTitle(home, { brand: false })).toBe(home);
  });

  test('a base that already names the brand is a build error', () => {
    // This is the live site's `/synergates` defect: the page title already contained the brand and
    // the template appended it again, producing "… | Πασσαλής Ακουστικά | Πασσαλής Ακουστικά".
    // Throwing here means it cannot ship a second time.
    expect(() => buildTitle('Συνεργάτες | Πασσαλής Ακουστικά')).toThrow(/already contains/i);
  });

  test('an empty base is a build error rather than a bare suffix', () => {
    expect(() => buildTitle('   ')).toThrow();
  });

  test('every rendered title stays inside what Google displays', () => {
    // Roughly 60 characters. The locality sits at the very end of the suffix, so anything longer
    // loses exactly the part the template exists to add.
    const bases = [
      'Τύποι Ακουστικών Βαρηκοΐας',
      'Ενδοκαναλικά Ακουστικά (CIC)',
      'Ακουστικά Ανοιχτής Εφαρμογής (RIC)',
      'Οπισθωτιαία Ακουστικά (BTE)',
      'Επαναφορτιζόμενα Ακουστικά',
      'Συνεργάτες: ΕΟΠΥΥ & Πάροχοι',
      'ΕΟΠΥΥ: Αποζημίωση Ακουστικών',
      'Πάροχοι: Signia, Siemens, Rexton',
      'Σχετικά με εμάς',
      'Συχνές Ερωτήσεις',
      'Επικοινωνία',
      'Πολιτική Απορρήτου',
    ];

    for (const base of bases) {
      const rendered = buildTitle(base);
      expect(rendered.length, `"${rendered}" is ${rendered.length} characters`).toBeLessThanOrEqual(
        65,
      );
    }
  });
});

describe('absolute URLs', () => {
  test('the origin is the apex host with no trailing slash', () => {
    expect(absoluteUrl('/akoustika')).toBe(`${BUSINESS.canonicalUrl}/akoustika`);
  });

  test('the home page keeps its single root slash', () => {
    expect(absoluteUrl('/')).toBe(`${BUSINESS.canonicalUrl}/`);
  });

  test('a trailing slash is removed, because the site serves none', () => {
    expect(absoluteUrl('/akoustika/')).toBe(`${BUSINESS.canonicalUrl}/akoustika`);
  });

  test('a path without a leading slash still resolves against the origin', () => {
    expect(absoluteUrl('akoustika')).toBe(`${BUSINESS.canonicalUrl}/akoustika`);
  });

  test('every known route produces a valid absolute https URL', () => {
    for (const path of Object.values(ROUTES)) {
      const url = absoluteUrl(path);
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});

describe('Markdown to plain text', () => {
  test('a link becomes its own text, and the URL is dropped', () => {
    expect(toPlainText('Δείτε [τη διαδικασία του ΕΟΠΥΥ](/synergates/eopyy).')).toBe(
      'Δείτε τη διαδικασία του ΕΟΠΥΥ.',
    );
  });

  test('emphasis markers are removed but the words stay', () => {
    expect(toPlainText('Είναι **ανώδυνος** και _δωρεάν_.')).toBe('Είναι ανώδυνος και δωρεάν.');
  });

  test('wrapped lines become one paragraph with single spaces', () => {
    expect(toPlainText('Μιλάμε πρώτα για το τι\nδυσκολεύεστε να ακούσετε.')).toBe(
      'Μιλάμε πρώτα για το τι δυσκολεύεστε να ακούσετε.',
    );
  });

  test('headings, list markers and quotes lose their syntax', () => {
    expect(toPlainText('## Τίτλος\n\n- πρώτο\n- δεύτερο\n\n> σημείωση')).toBe(
      'Τίτλος πρώτο δεύτερο σημείωση',
    );
  });

  test('inline code keeps its contents', () => {
    expect(toPlainText('Γράψτε `ΕΟΠΥΥ` στο πεδίο.')).toBe('Γράψτε ΕΟΠΥΥ στο πεδίο.');
  });

  test('plain prose is returned unchanged apart from trimming', () => {
    const prose = 'Ναι, καλύπτονται μέσω ΕΟΠΥΥ, εφόσον έχετε σχετική γνωμάτευση.';
    expect(toPlainText(`\n${prose}\n`)).toBe(prose);
  });

  test('no Markdown punctuation survives into an answer', () => {
    // Line-leading only, which is what Markdown actually treats as syntax. A hyphen or a `>` in
    // the middle of a sentence is punctuation and must survive, which the next test pins.
    const stripped = toPlainText('## ζ\n\n- θ\n\n> η\n\n[α](/β) **γ** _δ_ `ε`');
    expect(stripped).not.toMatch(/[[\]()*_`#>]/);
  });

  test('punctuation that is not syntax is left alone', () => {
    const prose = 'Κοστίζει 450€ — όχι 900€ (ανά ακουστικό), 9:00-17:00.';
    expect(toPlainText(prose)).toBe(prose);
  });
});

describe('breadcrumb trail', () => {
  test('home is prepended once and is the only linked root', () => {
    const trail = breadcrumbTrail([{ label: 'Ακουστικά' }]);

    expect(trail).toHaveLength(2);
    expect(trail[0]).toEqual({ label: 'Αρχική', href: ROUTES.home });
    expect(trail[1]?.href).toBeUndefined();
  });

  test('the JSON-LD describes exactly the trail the page renders', () => {
    const items = [{ label: 'Συνεργάτες', href: ROUTES.partners }, { label: 'ΕΟΠΥΥ' }];
    const trail = breadcrumbTrail(items);
    const schema = breadcrumbList(items);

    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(trail.length);
    expect(schema.itemListElement.map((entry) => entry.name)).toEqual(
      trail.map((entry) => entry.label),
    );
  });

  test('positions are one-based and consecutive', () => {
    const schema = breadcrumbList([
      { label: 'Συνεργάτες', href: ROUTES.partners },
      { label: 'ΕΟΠΥΥ' },
    ]);
    expect(schema.itemListElement.map((entry) => entry.position)).toEqual([1, 2, 3]);
  });

  test('every linked crumb carries an absolute item URL and the last carries none', () => {
    const schema = breadcrumbList([
      { label: 'Συνεργάτες', href: ROUTES.partners },
      { label: 'ΕΟΠΥΥ' },
    ]);
    const last = schema.itemListElement.at(-1);

    expect(schema.itemListElement[0]?.item).toBe(absoluteUrl(ROUTES.home));
    expect(schema.itemListElement[1]?.item).toBe(absoluteUrl(ROUTES.partners));
    expect(last?.item).toBeUndefined();
  });
});

describe('business structured data', () => {
  const business = hearingAidStore();

  test('it is the hearing-aid retail subtype, not the legacy MedicalBusiness stretch', () => {
    expect(business['@type']).toBe('HearingAidStore');
  });

  test('it carries a stable node id other schemas can reference', () => {
    expect(business['@id']).toBe(`${BUSINESS.canonicalUrl}/#business`);
  });

  test('the NAP matches the single source of truth exactly', () => {
    expect(business.name).toBe(BUSINESS.name);
    expect(business.telephone).toBe(BUSINESS.telephone.international);
    expect(business.email).toBe(BUSINESS.email);
    expect(business.address.streetAddress).toBe(BUSINESS.address.street);
    expect(business.address.addressLocality).toBe(BUSINESS.address.locality);
    expect(business.address.postalCode).toBe(BUSINESS.address.postalCode);
    expect(business.address.addressCountry).toBe(BUSINESS.address.countryCode);
  });

  test('the coordinates are the shop’s own, and inside Attica', () => {
    expect(business.geo.latitude).toBeCloseTo(BUSINESS.geo.latitude, 6);
    expect(business.geo.longitude).toBeCloseTo(BUSINESS.geo.longitude, 6);
    expect(business.geo.latitude).toBeGreaterThan(37.8);
    expect(business.geo.latitude).toBeLessThan(38.3);
    expect(business.geo.longitude).toBeGreaterThan(23.5);
    expect(business.geo.longitude).toBeLessThan(24.1);
  });

  test('opening hours come from the machine-readable form, not the display string', () => {
    const [spec] = business.openingHoursSpecification;
    const [block] = BUSINESS.openingHours.machine;

    expect(business.openingHoursSpecification).toHaveLength(BUSINESS.openingHours.machine.length);
    expect(spec?.['@type']).toBe('OpeningHoursSpecification');
    expect(spec?.dayOfWeek).toEqual([...(block?.days ?? [])]);
    expect(spec?.opens).toBe(block?.opens ?? '');
    expect(spec?.closes).toBe(block?.closes ?? '');
  });

  test('the service area names Marousi first', () => {
    expect(business.areaServed.length).toBeGreaterThan(0);
    expect(business.areaServed[0]?.name).toBe(BUSINESS.address.locality);
    for (const place of business.areaServed) {
      expect(place['@type']).toBe('Place');
      expect(place.name.trim().length).toBeGreaterThan(0);
    }
  });

  test('the image and logo are absolute URLs', () => {
    expect(business.image.startsWith('https://')).toBe(true);
    expect(business.logo.startsWith('https://')).toBe(true);
  });

  test('nothing unverified is claimed', () => {
    // The specification forbids ratings, prices and unsupported claims. `legalName` is omitted
    // too, because `BUSINESS.legalEntityName` is still a placeholder and a machine-readable legal
    // identity asserted on a guess is worse than an absent field.
    //
    // The placeholder currently equals the trading name, so checking the serialized output for it
    // would only ever match `name`. `legalName` is the distinct string, and it must not appear.
    expect(business).not.toHaveProperty('aggregateRating');
    expect(business).not.toHaveProperty('priceRange');
    expect(business).not.toHaveProperty('review');
    expect(business).not.toHaveProperty('sameAs');
    expect(business).not.toHaveProperty('legalName');
    expect(JSON.stringify(business)).not.toContain(BUSINESS.legalName);
  });
});

describe('website structured data', () => {
  const site = webSite();

  test('it declares Greek and points at the business as publisher', () => {
    expect(site['@type']).toBe('WebSite');
    expect(site.inLanguage).toBe(BUSINESS.language);
    expect(site.publisher['@id']).toBe(`${BUSINESS.canonicalUrl}/#business`);
  });

  test('there is no SearchAction, because there is no search', () => {
    // The live site claims one. It has never had a search feature.
    expect(site).not.toHaveProperty('potentialAction');
    expect(JSON.stringify(site)).not.toContain('SearchAction');
  });
});

describe('page structured data', () => {
  test('the FAQ schema answers in plain text and matches question for question', () => {
    const entries = [
      { question: 'Πόσο κρατάει;', answer: 'Περίπου **μία ώρα**.' },
      { question: 'Καλύπτεται;', answer: 'Ναι, [μέσω ΕΟΠΥΥ](/synergates/eopyy).' },
    ];
    const schema = faqPage(entries);

    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]?.name).toBe('Πόσο κρατάει;');
    expect(schema.mainEntity[0]?.acceptedAnswer.text).toBe('Περίπου μία ώρα.');
    expect(schema.mainEntity[1]?.acceptedAnswer.text).toBe('Ναι, μέσω ΕΟΠΥΥ.');
  });

  test('an FAQ answer never leaks Markdown syntax into the markup', () => {
    const schema = faqPage([
      { question: 'Q;', answer: 'Δείτε [εδώ](/synergates/eopyy) **τώρα**.' },
    ]);
    expect(schema.mainEntity[0]?.acceptedAnswer.text).not.toMatch(/[[\]()*]/);
  });

  test('the about and contact pages are more than a URL and a language', () => {
    const about = aboutPage({ name: 'Σχετικά με εμάς', description: 'Η ομάδα μας.' });
    const contact = contactPage({ name: 'Επικοινωνία', description: 'Βρείτε μας.' });

    for (const [schema, type, route] of [
      [about, 'AboutPage', ROUTES.about],
      [contact, 'ContactPage', ROUTES.contact],
    ] as const) {
      expect(schema['@type']).toBe(type);
      expect(schema.url).toBe(absoluteUrl(route));
      expect(schema.inLanguage).toBe(BUSINESS.language);
      expect(schema.name.trim().length).toBeGreaterThan(0);
      expect(schema.description.trim().length).toBeGreaterThan(0);
      expect(schema.about['@id']).toBe(`${BUSINESS.canonicalUrl}/#business`);
    }
  });
});

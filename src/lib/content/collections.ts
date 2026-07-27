import { type CollectionEntry, getCollection, getEntry } from 'astro:content';

/**
 * Typed accessors for the content collections.
 *
 * Pages should call these rather than `getCollection` directly, for two reasons: ordering is
 * applied in one place, and category references are verified here.
 *
 * `reference()` in the schema only reshapes a value into `{ id, collection }` — it does not
 * check that the referenced entry exists. A mistyped `type:` would therefore pass schema
 * validation and only surface as an undefined lookup while rendering. `assertTypesResolve`
 * closes that gap by failing the build with a message naming the offending file.
 */

type HearingType = CollectionEntry<'hearing-types'>;
type HearingModel = CollectionEntry<'hearing-models'>;
type Faq = CollectionEntry<'faqs'>;
type Provider = CollectionEntry<'providers'>;
type Page = CollectionEntry<'pages'>;

function byOrder<T extends { data: { order: number } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.data.order - b.data.order);
}

/** All four categories, in display order. */
export async function getHearingTypes(): Promise<HearingType[]> {
  return byOrder(await getCollection('hearing-types'));
}

/** Throws if any model points at a category that does not exist. */
function assertTypesResolve(models: HearingModel[], types: HearingType[]): void {
  const known = new Set(types.map((type) => type.id));
  const broken = models
    .filter((model) => !known.has(model.data.type.id))
    .map((model) => `${model.id} -> "${model.data.type.id}"`);

  if (broken.length > 0) {
    throw new Error(
      `Unknown hearing type referenced by ${broken.length} hearing model(s): ${broken.join(', ')}. ` +
        `Known types: ${[...known].sort().join(', ')}.`,
    );
  }
}

/** All models, in display order, with every category reference verified. */
export async function getHearingModels(): Promise<HearingModel[]> {
  const [models, types] = await Promise.all([getCollection('hearing-models'), getHearingTypes()]);
  assertTypesResolve(models, types);
  return byOrder(models);
}

/** The models belonging to one category, in display order. */
export async function getModelsForType(typeId: string): Promise<HearingModel[]> {
  const models = await getHearingModels();
  return models.filter((model) => model.data.type.id === typeId);
}

/** The models shown in the home page's "Τα ακουστικά μας" section, in category order. */
export async function getFeaturedModels(): Promise<HearingModel[]> {
  const [models, types] = await Promise.all([getHearingModels(), getHearingTypes()]);
  const typeOrder = new Map(types.map((type) => [type.id, type.data.order]));

  return models
    .filter((model) => model.data.featured)
    .sort((a, b) => {
      const typeDifference =
        (typeOrder.get(a.data.type.id) ?? 0) - (typeOrder.get(b.data.type.id) ?? 0);
      return typeDifference !== 0 ? typeDifference : a.data.order - b.data.order;
    });
}

/** All questions, in display order. */
export async function getFaqs(): Promise<Faq[]> {
  return byOrder(await getCollection('faqs'));
}

/** All manufacturers, in display order. */
export async function getProviders(): Promise<Provider[]> {
  return byOrder(await getCollection('providers'));
}

/** A long-form page by id, throwing rather than returning undefined when it is missing. */
export async function getPage(id: string): Promise<Page> {
  const page = await getEntry('pages', id);
  if (!page) {
    throw new Error(`Missing page entry "${id}" in src/content/pages.`);
  }
  return page;
}

/** The EOPYY reimbursement figures, which the home page card also renders. */
export async function getEopyySubsidy(): Promise<
  NonNullable<CollectionEntry<'pages'>['data']['subsidy']>
> {
  const { data } = await getPage('eopyy');
  if (!data.subsidy) {
    throw new Error('src/content/pages/eopyy.mdx is missing its `subsidy` frontmatter.');
  }
  return data.subsidy;
}

import type { APIRoute } from 'astro';
import { LAST_MODIFIED, SITEMAP_ROUTES } from '@/data/sitemap';
import { absoluteUrl } from '@/lib/seo/urls';

/**
 * `/sitemap.xml`, at exactly the URL the live site has always served and Search Console already
 * has submitted.
 *
 * Hand-written rather than `@astrojs/sitemap`, for that reason above all: the integration emits
 * `sitemap-index.xml` plus `sitemap-0.xml`, which would mean re-submitting and waiting for a
 * thirteen-URL site that fits in one file several times over. It also adds a dependency to produce
 * thirty lines, and its `lastmod` control runs through a `serialize` hook that would end up
 * reimplementing `LAST_MODIFIED` anyway.
 *
 * No `changefreq` and no `priority`. Google has said for years that it ignores both, and the live
 * site's `changefreq=weekly` on every URL with `priority` 1.0 and 0.7 is a good illustration of
 * why: the numbers describe nothing and are never revisited.
 */
export const prerender = true;

export const GET: APIRoute = () => {
  const urls = SITEMAP_ROUTES.map((path) =>
    [
      '  <url>',
      `    <loc>${absoluteUrl(path)}</loc>`,
      `    <lastmod>${LAST_MODIFIED[path]}</lastmod>`,
      '  </url>',
    ].join('\n'),
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

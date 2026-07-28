import type { APIRoute } from 'astro';
import { absoluteUrl } from '@/lib/seo/urls';

/**
 * `/robots.txt`.
 *
 * The live site's is almost identical, with one defect: it advertises the sitemap as
 * `…/sitemap.xml/`, with a trailing slash, because the trailing slash is written into the source
 * string. Requesting that URL returns a 308 to the correct one, so every crawler that reads this
 * file takes an extra hop for no reason. Fixed here by not doing it.
 *
 * `Disallow: /api/` is a crawl hint and nothing more. The contact endpoint is protected by its own
 * origin check and rate limiter; a `robots.txt` rule is a request, not access control, and anything
 * that ignores it was never going to read this file.
 */
export const prerender = true;

export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

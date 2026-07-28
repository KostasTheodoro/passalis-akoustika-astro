import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField, fontProviders } from 'astro/config';
import icon from 'astro-icon';

const sansation = 'src/assets/fonts/sansation';

export default defineConfig({
  output: 'static',
  /**
   * The production origin. Nothing in the head reads this — canonicals come from
   * `BUSINESS.canonicalUrl`, which is the same string and is the source of truth the tests pin —
   * but Astro needs it set for `Astro.site` to exist, and leaving it undefined is what makes
   * `new URL(path, Astro.site)` throw.
   *
   * It is deliberately the apex host on every build, preview deployments included. A preview that
   * canonicalised to itself would be asking Google to index the preview.
   */
  site: 'https://passalis-akoustika.gr',
  /**
   * The live site serves every URL without a trailing slash, and `/akoustika/` normalises to
   * `/akoustika`. Matching it here keeps the twelve indexed URLs identical and stops the same page
   * being reachable at two addresses.
   */
  trailingSlash: 'never',
  /**
   * `astro-icon` resolves Iconify names to inline SVG at build time — no runtime library, no icon
   * font, no sprite request, and only the icons actually used reach the output.
   *
   * Two sets, for one reason each: Lucide is the shell set (one consistent 24px stroke grid), and
   * Heroicons is kept because the live site's four service icons are drawn from it, so keeping
   * them there means they do not change. `src/data/icons.ts` is the only place that names them.
   *
   * No `include` option: without it the integration reads the installed `@iconify-json/*` packages
   * on demand and emits only the icons a page actually renders. Setting `include` would pull whole
   * collections into the build.
   */
  /**
   * `mdx()` must be registered *before* anything that reads content, and it is a build-time
   * integration only: it compiles the prose bodies and ships no runtime library, so it costs the
   * browser nothing.
   *
   * Every prose body on the site is `.mdx` rather than `.md`. The reason is not that any of them
   * needs a component today, it is that the privacy page has to print the shop's telephone and
   * email, and in plain Markdown those would be hard-coded strings in a content file. `business.ts`
   * exists precisely because the legacy site kept three copies of those details and they had
   * drifted apart. MDX lets the page import the one source instead.
   *
   * MDX is not a free superset of Markdown: `{`, `}` and `<` are syntax. All sixteen bodies were
   * checked for those characters before the rename and none contained any.
   */
  integrations: [mdx(), react(), icon()],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
  /**
   * `PUBLIC_SITE_URL` is the only client-readable value here. Everything the contact endpoint needs
   * is `context: 'server', access: 'secret'`, which is what keeps it out of the browser bundle.
   *
   * The recipient and sender addresses are not secrets in the way an API key is, but they are the
   * addresses a spam harvester would most like to have, and there is no reason for either to reach
   * a client. `access: 'secret'` is the setting that guarantees that rather than relying on nobody
   * importing them from the wrong side.
   *
   * **`RESEND_API_KEY` is optional on purpose.** Without it the mailer does not send: it logs a
   * redacted summary and the form reports development behaviour explicitly. That is what lets the
   * whole step build, run and be tested with no production credentials, and it is also why the test
   * suite cannot send real email by construction rather than by discipline. The key, the verified
   * sending domain and the firewall rule are all STEP-11's.
   */
  env: {
    schema: {
      PUBLIC_SITE_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:4321',
      }),
      /**
       * Emits `<meta name="google-site-verification">` when set, and nothing when not.
       *
       * The live site has no such tag, so Search Console is verified by DNS TXT, an HTML file or
       * the Analytics method — nothing on record says which. DNS TXT survives a change of host and
       * the others do not, so this exists to make re-verification at cutover a dashboard entry
       * rather than a code change. A verification token is public by definition.
       */
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      RESEND_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CONTACT_RECIPIENT_EMAIL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CONTACT_SENDER_EMAIL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CONTACT_SENDER_NAME: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        default: 'Πασσαλής Ακουστικά',
      }),
    },
  },
  /**
   * Images are optimized at build time by sharp and shipped as static files. The Vercel adapter's
   * `imageService` is deliberately left unset, so nothing is optimized at runtime.
   *
   * There is no `domains` and no `remotePatterns` list: every image the site renders is local,
   * and leaving both empty means a remote source cannot quietly creep back in.
   */
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  /**
   * Sansation, self-hosted. Only the four faces the site actually uses are registered — the
   * legacy Light and LightItalic files are not carried over, because no `font-light` or
   * `font-thin` class exists anywhere in the source.
   *
   * `font-semibold` (600) and `font-extrabold` (800) have no real face and are rounded by the
   * browser to 400 and 700, exactly as on the live site.
   */
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Sansation',
      cssVariable: '--font-sansation',
      options: {
        variants: [
          { weight: 400, style: 'normal', src: [`./${sansation}/Sansation-Regular.woff2`] },
          { weight: 700, style: 'normal', src: [`./${sansation}/Sansation-Bold.woff2`] },
          { weight: 400, style: 'italic', src: [`./${sansation}/Sansation-Italic.woff2`] },
          { weight: 700, style: 'italic', src: [`./${sansation}/Sansation-BoldItalic.woff2`] },
        ],
      },
    },
  ],
});

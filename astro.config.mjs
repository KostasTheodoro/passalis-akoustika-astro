import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField, fontProviders } from 'astro/config';
import icon from 'astro-icon';

const sansation = 'src/assets/fonts/sansation';

export default defineConfig({
  output: 'static',
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
  integrations: [react(), icon()],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      PUBLIC_SITE_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:4321',
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

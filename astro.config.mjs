import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField, fontProviders } from 'astro/config';

const sansation = 'src/assets/fonts/sansation';

export default defineConfig({
  output: 'static',
  integrations: [react()],
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

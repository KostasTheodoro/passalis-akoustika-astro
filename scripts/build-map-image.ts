import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

/**
 * Builds the blurred map that sits behind the contact page's map panel.
 *
 * **Run once, by hand.** It is not wired into `bun run build`, deliberately: the output is committed
 * and production must never depend on a third-party tile server being up. Re-run it only if the shop
 * moves or the look needs changing.
 *
 * ```
 * bun run scripts/build-map-image.ts
 * ```
 *
 * ## Why OpenStreetMap
 *
 * A map tile is somebody's copyrighted cartography. Google's Static Maps API would be the closest
 * match to the embed that loads on click, but it needs an account, a key and a billing card, which
 * is a new external service for a decorative background. OpenStreetMap needs none of those.
 *
 * **ODbL requires attribution**, and `MapFacade.astro` carries it: `© OpenStreetMap contributors`.
 * That line is not optional and must not be removed with the image still in place.
 *
 * The tiles are fetched **once, here**, not at build time and never at runtime, so this does not
 * lean on OSM's tile servers for traffic. Their usage policy asks exactly that.
 *
 * ## Why the blur is baked in
 *
 * Three reasons, in order of how much they matter:
 *
 * 1. **The sharp cartography is never delivered to anyone.** What ships is an image from which the
 *    original cannot be recovered, which is the cleanest answer to the licence question.
 * 2. A heavily blurred image compresses to a fraction of the sharp one: mostly low-frequency data,
 *    which is what image codecs are best at.
 * 3. The browser does no filter work, so nothing repaints on scroll.
 */

/** The shop, from `src/data/external-links.ts`. */
const LATITUDE = 38.0483082;
const LONGITUDE = 23.807228;

/** Close enough to show the street grid, far enough that the blur has something to work with. */
const ZOOM = 16;

/** Tiles across and down. 3×2 covers the panel's aspect ratio with room to crop. */
const COLUMNS = 3;
const ROWS = 2;

const TILE = 256;
const OUTPUT = 'src/assets/images/map-marousi-blurred.webp';

/** Web Mercator: longitude and latitude to fractional tile coordinates at a given zoom. */
function tileX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function tileY(latitude: number, zoom: number): number {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom;
}

async function fetchTile(x: number, y: number, zoom: number): Promise<Buffer> {
  const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

  // A real User-Agent is required by OSM's tile usage policy. A request without one is refused.
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'passalis-akoustika-astro/1.0 (one-off asset build; contact via passalis-akoustika.gr)',
    },
  });

  if (!response.ok) {
    throw new Error(`tile ${zoom}/${x}/${y} returned ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const centreX = tileX(LONGITUDE, ZOOM);
  const centreY = tileY(LATITUDE, ZOOM);

  const firstX = Math.floor(centreX) - Math.floor(COLUMNS / 2);
  const firstY = Math.floor(centreY) - Math.floor(ROWS / 2);

  console.info(`fetching ${COLUMNS * ROWS} tiles around ${LATITUDE}, ${LONGITUDE} at zoom ${ZOOM}`);

  const parts: { input: Buffer; left: number; top: number }[] = [];

  for (let column = 0; column < COLUMNS; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const tile = await fetchTile(firstX + column, firstY + row, ZOOM);
      parts.push({ input: tile, left: column * TILE, top: row * TILE });

      // OSM asks for no more than a couple of requests a second from a single client.
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });

  /**
   * Two passes, and the reason is a real trap.
   *
   * `sharp` does not run its operations in the order they are chained. `composite` is applied late
   * in its fixed internal pipeline, *after* `resize` and `blur`. Doing all of it in one chain
   * produced a sharp mosaic sitting in the top-left quarter of a blurred blank canvas, because the
   * resize enlarged the empty base and the tiles were then pasted at their original offsets.
   *
   * So: stitch first, finish the stitched buffer second.
   */
  const mosaic = await sharp({
    create: {
      width: COLUMNS * TILE,
      height: ROWS * TILE,
      channels: 3,
      background: { r: 245, g: 243, b: 240 },
    },
  })
    .composite(parts)
    .png()
    .toBuffer();

  // Where the shop actually falls inside the mosaic, so the crop is centred on it rather than on
  // whichever tile boundary happened to be nearest.
  const shopX = Math.round((centreX - firstX) * TILE);
  const shopY = Math.round((centreY - firstY) * TILE);

  const cropWidth = 640;
  const cropHeight = 400;

  const left = Math.max(0, Math.min(COLUMNS * TILE - cropWidth, shopX - cropWidth / 2));
  const top = Math.max(0, Math.min(ROWS * TILE - cropHeight, shopY - cropHeight / 2));

  await sharp(mosaic)
    .extract({ left: Math.round(left), top: Math.round(top), width: cropWidth, height: cropHeight })
    // Enlarged before blurring so the blur has room to work and stays smooth when the panel is
    // drawn wide on a desktop.
    .resize(cropWidth * 2, cropHeight * 2, { kernel: 'lanczos3' })
    .blur(9)
    // Pulled towards the page's own neutrals so the teal panel content sits on it comfortably.
    .modulate({ saturation: 0.85, brightness: 1.04 })
    .webp({ quality: 62 })
    .toFile(OUTPUT);

  const { size, width, height } = await sharp(OUTPUT).metadata();
  console.info(
    `wrote ${OUTPUT} ${width}x${height}${size ? ` (${Math.round(size / 1024)} kB)` : ''}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

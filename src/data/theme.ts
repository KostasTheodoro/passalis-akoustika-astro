/**
 * The one colour that has to exist as a literal outside the stylesheet.
 *
 * `<meta name="theme-color">` tints the browser chrome on Android and in installed windows, and it
 * takes a colour value — not a `var()`, not a class. So the identity teal has to be written as a
 * hex somewhere in TypeScript, which is exactly what `tokens.test.ts` forbids components from
 * doing, and rightly: a hex copied into a component is a colour that stops tracking the palette.
 *
 * This is the compromise. One constant, in one file, with `tokens.test.ts` asserting it equals
 * `--color-brand` as parsed from `global.css`. Change the token and the test fails until this
 * follows, so the two cannot drift.
 *
 * It is the identity teal rather than `brand-strong`, because nothing is drawn on top of it — the
 * browser picks its own contrasting colour for whatever it puts over the tint.
 */
export const THEME_COLOR = '#149b9e';

/** The manifest's `background_color`, for the same reason. Mirrors `--color-surface`. */
export const BACKGROUND_COLOR = '#ffffff';

/**
 * Reduces a Markdown body to the sentence a reader actually sees.
 *
 * This exists for one job: `FAQPage` structured data. Google wants the answer text, and the answer
 * on the page is rendered from MDX — one of the fourteen now carries a link, so the raw body and
 * the visible text are no longer the same string.
 *
 * It is deliberately small and deliberately not a Markdown parser. The guarantee that it is correct
 * does not come from this file, it comes from `tests/e2e/seo.spec.ts`, which compares what this
 * produces against the text the browser renders for every question. If a body ever grows syntax
 * this does not understand, that test fails rather than a wrong answer shipping.
 */
export function toPlainText(markdown: string): string {
  return (
    markdown
      // Links and images: keep the label, drop the target. Images have no label worth keeping.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Inline code and emphasis markers, keeping the words between them.
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Line-leading syntax: headings, block quotes, list bullets and ordered markers.
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/^\s{0,3}\d+\.\s+/gm, '')
      // Wrapped source lines are one paragraph to a reader, so they become one to a crawler too.
      .replace(/\s+/g, ' ')
      .trim()
  );
}

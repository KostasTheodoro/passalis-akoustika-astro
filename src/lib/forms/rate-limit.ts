/**
 * The durable limit, and the honest fallback when it is not available.
 *
 * **Why this needs more than a counter.** `/api/contact` is the only route on the site that accepts
 * a public POST and causes an outbound email, and it sends to an address the *submitter* chooses,
 * because of the visitor acknowledgement. Left uncapped, it can be pointed at somebody's inbox and
 * used to send them mail from our verified domain. The complaints land against the shop's sending
 * reputation, not the attacker's. That, rather than a burnt Resend quota, is why this file exists.
 *
 * **Why it cannot simply be an in-memory counter.** A Vercel function may serve two requests on two
 * instances in two regions, and instances are recycled. Fluid Compute reuses them, so a counter in
 * memory does survive some requests, but nothing guarantees any two see the same memory. It is a
 * speed bump, not a limit.
 *
 * So the real limit is Vercel's own, evaluated at the edge before the function runs, and this
 * module is the thin wrapper that calls it and copes when it is not there.
 */

/** Five in ten minutes. A person sending a second enquiry is normal; a sixth in ten minutes is not. */
const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 60 * 1_000;

export type RateLimitOutcome = {
  limited: boolean;
  /** Which layer answered. Reported in `result.md` and asserted in tests; never sent to a visitor. */
  source: 'firewall' | 'memory';
};

/** Per-instance history, used both as the fallback and as a second line under the firewall. */
const hits = new Map<string, number[]>();

function checkMemory(key: string, now: number): boolean {
  const since = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((at) => at > since);

  recent.push(now);
  hits.set(key, recent);

  // The map is keyed by IP hash and would otherwise grow for the life of the instance.
  if (hits.size > 5_000) {
    for (const [entry, times] of hits) {
      if (times.every((at) => at <= since)) hits.delete(entry);
    }
  }

  return recent.length > MAX_REQUESTS;
}

/**
 * Asks the firewall where there is one, and the in-memory limiter always.
 *
 * **`@vercel/firewall` does not fail loudly off-platform, which is the trap here.** Away from
 * Vercel it does not throw: it logs a warning and returns `rateLimited: false`. Code that simply
 * called it and trusted the answer would therefore report "not limited" for every request in
 * development, in the test suite, and anywhere the firewall rule had not actually been created,
 * while looking like it had a durable limiter. That is failing open while appearing not to.
 *
 * So the firewall is consulted only when running on Vercel, and the in-memory limiter runs
 * regardless and is OR'd in. `source` then reports which layer genuinely answered, which is what
 * `result.md` records and what STEP-11 needs to check once the rule exists.
 *
 * The import is dynamic so the package is loaded only where it can work.
 */
export async function checkRateLimit(
  key: string,
  now: number = Date.now(),
): Promise<RateLimitOutcome> {
  const memoryLimited = checkMemory(key, now);

  // Set by the platform on every Vercel deployment, and by nothing else.
  if (!process.env.VERCEL) return { limited: memoryLimited, source: 'memory' };

  try {
    const { checkRateLimit: checkFirewall } = await import('@vercel/firewall');
    const { rateLimited } = await checkFirewall('contact', { rateLimitKey: key });

    return { limited: rateLimited || memoryLimited, source: 'firewall' };
  } catch {
    return { limited: memoryLimited, source: 'memory' };
  }
}

/** Exposed for tests, which must not inherit counts from each other. */
export function resetRateLimits(): void {
  hits.clear();
}

export const RATE_LIMIT = { maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS } as const;

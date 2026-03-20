import type { Locator } from "@playwright/test";

/**
 * Tries each candidate locator in order and returns the first one that is visible.
 * Throws if none of the candidates resolve within the timeout.
 */
export async function resolveFirstVisible(
  candidates: Locator[],
  options: { timeout?: number } = {},
): Promise<Locator> {
  const timeout = options.timeout ?? 5000;
  const perCandidate = Math.max(200, Math.floor(timeout / candidates.length));

  for (const candidate of candidates) {
    try {
      await candidate.first().waitFor({
        state: "visible",
        timeout: perCandidate,
      });
      return candidate.first();
    } catch {
      // Try next candidate
    }
  }

  throw new Error(
    `None of the ${candidates.length} locator candidates resolved within ${timeout}ms`,
  );
}

/**
 * Polls multiple container selectors for a matching element containing the given text.
 * Returns the first matching locator found within the timeout.
 */
export async function pollForMatch(
  candidates: Locator[],
  options: { timeout?: number; interval?: number } = {},
): Promise<Locator> {
  const timeout = options.timeout ?? 7000;
  const interval = options.interval ?? 500;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      try {
        const count = await candidate.count();
        if (count > 0) {
          return candidate.first();
        }
      } catch {
        // Continue polling
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `No matching element found among ${candidates.length} candidates within ${timeout}ms`,
  );
}

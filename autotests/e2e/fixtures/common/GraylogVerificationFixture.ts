import { spawnSync } from "child_process";
import * as path from "path";

/**
 * One Graylog log message (subset — Graylog returns many fields; these are the
 * ones actually used by cron verification specs).
 */
export interface GlMessage {
  timestamp: string;
  message: string;
  source?: string;
  level?: number;
  logger_name?: string;
  thread_name?: string;
  application_name?: string;
  [key: string]: unknown;
}

export interface SearchOptions {
  /** Stream name — defaults to the active env's stream. */
  stream?: string;
  /** Graylog query-language string (e.g. `message:"Digests sending job started"`). */
  query: string;
  /** Relative range in seconds or "5m"/"2h"/"1d" shape (default "5m"). */
  range?: string;
  /** Absolute start (ISO or "1h") — overrides range. */
  since?: string;
  /** Absolute end (default "now"). */
  until?: string;
  limit?: number;
  sort?: string;
}

export interface WaitForMarkerOptions extends SearchOptions {
  /** Total poll budget in ms (default 30 000). */
  timeoutMs?: number;
  /** Poll interval in ms (default 5 000). */
  intervalMs?: number;
  /** Require exactly this many hits (default: ≥ 1). */
  exactCount?: number;
  /** Predicate applied to each hit; first truthy match wins. */
  match?: (msg: GlMessage) => boolean;
}

/**
 * Verifies TTT backend log output in Graylog per environment.
 *
 * Wraps the graylog-access skill's Python CLI (`scripts/graylog_api.py`) via
 * child_process.spawnSync. The skill is canonical — this fixture formats
 * arguments, parses JSON output, and exposes polling / absence-assertion
 * helpers.
 *
 * Environment independence: the fixture derives the stream name from the env
 * string at call time (`qa-1` → `TTT-QA-1`, `timemachine` → `TTT-TIMEMACHINE`).
 * Specs pass the env via constructor; they never hard-code stream names.
 *
 * Intended use: asserting presence / absence of scheduler markers and
 * per-recipient mail-sent markers for cron jobs. See CLAUDE+.md §11
 * "Cron-Job TCs — Dual-Trigger Principle" — Variant A asserts scheduler
 * markers present, Variant B asserts them absent (wrapper bypass).
 */
export class GraylogVerificationFixture {
  private readonly scriptPath: string;
  private readonly defaultStream: string;

  /**
   * @param env — env identifier from the active AppConfig (e.g. TttConfig.env).
   *   Used to derive the default stream name.
   * @param repoRoot — optional override (default: auto-detect relative to this file).
   */
  constructor(env: string, repoRoot?: string) {
    const root = repoRoot ?? this.findRepoRoot();
    this.scriptPath = path.join(
      root,
      ".claude",
      "skills",
      "graylog-access",
      "scripts",
      "graylog_api.py",
    );
    this.defaultStream = this.deriveStream(env);
  }

  /**
   * Map an env id to its Graylog stream. Public so specs can override per TC
   * if needed. Mapping rule: `TTT-<ENV_UPPER>`, with `-` preserved (qa-1 → QA-1).
   */
  deriveStream(env: string): string {
    return `TTT-${env.toUpperCase()}`;
  }

  /**
   * One-shot search. Returns hits sorted newest-first.
   */
  search(opts: SearchOptions): GlMessage[] {
    const args = this.buildSearchArgs("search", opts);
    const out = this.runCli(args);
    const parsed = JSON.parse(out);
    return (parsed.messages ?? []) as GlMessage[];
  }

  /**
   * Count matching messages.
   */
  count(opts: SearchOptions): number {
    const args = this.buildSearchArgs("count", opts);
    const out = this.runCli(args);
    const parsed = JSON.parse(out);
    return parsed.count ?? parsed.total ?? 0;
  }

  /**
   * Poll until a matching log line appears, then return the first match.
   * Use for Variant-A scheduler marker assertions (e.g. wait for
   * "Digests sending job finished" after advancing the clock).
   */
  async waitForMarker(opts: WaitForMarkerOptions): Promise<GlMessage> {
    const timeout = opts.timeoutMs ?? 30_000;
    const interval = opts.intervalMs ?? 5_000;
    const deadline = Date.now() + timeout;
    let lastHits: GlMessage[] = [];

    while (Date.now() < deadline) {
      const hits = this.search(opts);
      lastHits = hits;
      for (const hit of hits) {
        if (opts.match && !opts.match(hit)) continue;
        return hit;
      }
      if (Date.now() + interval >= deadline) break;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(
      `Timed out after ${timeout}ms waiting for Graylog marker matching ` +
        `${JSON.stringify({ query: opts.query, stream: opts.stream ?? this.defaultStream })}. ` +
        `Last poll returned ${lastHits.length} hits.`,
    );
  }

  /**
   * Assert the query has zero hits in the given window. Used for Variant B
   * (test endpoint) to prove the scheduler wrapper was bypassed (no
   * start/finish markers).
   *
   * Waits `settleMs` before querying so any in-flight log shipping has a
   * chance to settle — otherwise a racy "absent" check can pass for a marker
   * that arrives a moment later.
   */
  async assertAbsent(
    opts: SearchOptions & { settleMs?: number },
  ): Promise<void> {
    const settle = opts.settleMs ?? 5_000;
    await new Promise((r) => setTimeout(r, settle));
    const hits = this.search(opts);
    if (hits.length > 0) {
      throw new Error(
        `Expected zero Graylog hits for ${JSON.stringify(opts.query)} on ` +
          `${opts.stream ?? this.defaultStream} but found ${hits.length}. ` +
          `First hit: ${JSON.stringify(hits[0]).slice(0, 500)}`,
      );
    }
  }

  /**
   * Count per-recipient markers grouped by the extracted email address.
   * Used for digest TCs that seed N recipients and assert one mail-sent
   * marker per recipient.
   *
   * @param extractEmail — pattern with a single capture group that isolates
   *   the recipient email from each message. Example for digest:
   *   `/Mail has been sent to ([\w.+@-]+) about NOTIFY_VACATION_UPCOMING/`.
   */
  countPerRecipient(
    opts: SearchOptions,
    extractEmail: RegExp,
  ): Map<string, number> {
    const hits = this.search(opts);
    const counts = new Map<string, number>();
    for (const hit of hits) {
      const match = (hit.message ?? "").match(extractEmail);
      if (match && match[1]) {
        counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
      }
    }
    return counts;
  }

  private buildSearchArgs(sub: "search" | "count", opts: SearchOptions): string[] {
    const args = [sub, "--stream", opts.stream ?? this.defaultStream];
    args.push("--query", opts.query);
    if (opts.since) {
      args.push("--since", opts.since);
      if (opts.until) args.push("--until", opts.until);
    } else {
      args.push("--range", opts.range ?? "5m");
    }
    if (sub === "search") {
      if (opts.limit != null) args.push("--limit", String(opts.limit));
      if (opts.sort) args.push("--sort", opts.sort);
    }
    return args;
  }

  private runCli(args: string[]): string {
    const result = spawnSync("python3", [this.scriptPath, ...args], {
      encoding: "utf8",
      timeout: 60_000,
    });
    if (result.status !== 0) {
      throw new Error(
        `graylog_api.py ${args.join(" ")} exited with ${result.status}:\n` +
          `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    }
    return result.stdout;
  }

  private findRepoRoot(): string {
    return path.resolve(__dirname, "..", "..", "..", "..");
  }
}

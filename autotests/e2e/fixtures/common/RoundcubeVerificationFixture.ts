import { spawnSync } from "child_process";
import * as path from "path";

/**
 * Summary view of a Roundcube/IMAP message (headers only).
 */
export interface RcMessage {
  uid: number;
  seq: number | null;
  internal_date: string | null;
  size: number | null;
  flags: string[];
  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  date: string | null;
  message_id: string | null;
}

/**
 * Full Roundcube message including body text.
 */
export interface RcFullMessage extends RcMessage {
  text_body: string;
  html_body?: string;
}

export interface SearchOptions {
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
  since?: Date;
  before?: Date;
  limit?: number;
  offset?: number;
  mailbox?: string;
}

export interface WaitForEmailOptions extends SearchOptions {
  /** Inclusive lower-bound for when the email must have arrived. */
  sinceSearch: Date;
  /** Optional predicate — called on each candidate message; first truthy match wins. */
  match?: (msg: RcMessage) => boolean;
  /** Total poll budget in ms (default 30 000). */
  timeoutMs?: number;
  /** Poll interval in ms (default 5 000). */
  intervalMs?: number;
}

/**
 * Verifies TTT notification emails in the shared QA Roundcube mailbox.
 *
 * Wraps the roundcube-access skill's Python CLI (`scripts/roundcube_imap.py`)
 * via child_process.spawnSync. The skill is canonical — this fixture formats
 * arguments, parses JSON output, and exposes polling / assertion helpers.
 *
 * Environment independence: the Python CLI reads `config/roundcube/roundcube.yaml`
 * to determine which env to talk to. Specs pass subject patterns using `<ENV>`
 * placeholders or regex; the fixture resolves them against the active env via
 * `TttConfig.env` at call time.
 *
 * Intended use: cron-delivered email notifications (digest, forgot-to-report,
 * approval, etc.) where the test must assert every dynamic field the template
 * renders. See CLAUDE+.md §11 "Content-Complete Verification for Notification TCs".
 */
export class RoundcubeVerificationFixture {
  private readonly scriptPath: string;

  constructor(repoRoot?: string) {
    const root = repoRoot ?? this.findRepoRoot();
    this.scriptPath = path.join(
      root,
      ".claude",
      "skills",
      "roundcube-access",
      "scripts",
      "roundcube_imap.py",
    );
  }

  /**
   * Count messages matching the search criteria. Used for baseline-before-trigger
   * diffing: call before the trigger, then after poll finishes, compare.
   *
   * The CLI's `count` subcommand only accepts `--mailbox` — it does not take
   * filter flags. We therefore issue a `search --limit 1` and read `total` from
   * the response, which reports the full IMAP SEARCH match count regardless of
   * the per-call item limit.
   */
  count(opts: SearchOptions = {}): number {
    const args = ["search"];
    this.appendSearchArgs(args, { ...opts, limit: 1 });
    const out = this.runCli(args);
    const parsed = JSON.parse(out);
    return parsed.total ?? 0;
  }

  /**
   * One-shot IMAP SEARCH. Returns newest-first by UID.
   * Subject / from / body args use IMAP SEARCH "contains" semantics (UTF-8 aware).
   */
  search(opts: SearchOptions = {}): RcMessage[] {
    const args = ["search"];
    this.appendSearchArgs(args, opts);
    const out = this.runCli(args);
    const parsed = JSON.parse(out);
    return (parsed.items ?? []) as RcMessage[];
  }

  /**
   * Poll the mailbox until an email matching the criteria arrives or the
   * timeout expires. Returns the first matching message (newest UID).
   *
   * The 20 s email-service dispatch loop plus any settle slack means the
   * default 30 s window is the minimum practical budget for cron-driven mail.
   */
  async waitForEmail(opts: WaitForEmailOptions): Promise<RcMessage> {
    const timeout = opts.timeoutMs ?? 30_000;
    const interval = opts.intervalMs ?? 5_000;
    const deadline = Date.now() + timeout;
    const since = opts.since ?? opts.sinceSearch;
    let lastMessages: RcMessage[] = [];

    while (Date.now() < deadline) {
      const messages = this.search({ ...opts, since });
      lastMessages = messages;
      for (const msg of messages) {
        if (!this.isAfter(msg, opts.sinceSearch)) continue;
        if (opts.match && !opts.match(msg)) continue;
        return msg;
      }
      if (Date.now() + interval >= deadline) break;
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(
      `Timed out after ${timeout}ms waiting for Roundcube email matching ` +
        `${JSON.stringify(opts)}. Last poll returned ${lastMessages.length} ` +
        `candidates — none matched.`,
    );
  }

  /**
   * Fetch full body for an already-identified message. Use after `waitForEmail`
   * or `search` to run content-complete assertions on the body.
   *
   * The underlying CLI returns raw `text` and `html` keys. This wrapper
   * normalises them into `text_body` / `html_body` and — critically for
   * HTML-only templates like the digest — falls back to a tag-stripped view
   * of the HTML when `text` is empty, so `assertBodyContains` can still
   * assert on rendered fragments without callers having to parse HTML.
   */
  read(uid: number, opts: { includeHtml?: boolean; mailbox?: string } = {}): RcFullMessage {
    const args = ["read", String(uid), "--include-html"];
    if (opts.mailbox) args.push("--mailbox", opts.mailbox);
    const out = this.runCli(args);
    const parsed = JSON.parse(out);
    const html = typeof parsed.html === "string" ? parsed.html : "";
    let text = typeof parsed.text === "string" ? parsed.text : "";
    if (!text && html) {
      text = this.htmlToText(html);
    }
    return {
      ...(parsed as RcMessage),
      text_body: text,
      html_body: html || undefined,
    } as RcFullMessage;
  }

  /**
   * Minimal HTML→plain-text reducer: strips tags, decodes a small set of
   * entities, collapses whitespace. Used when an email has no plain-text part
   * so body assertions can still operate on rendered content.
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/td>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  /**
   * Assert every expected fragment appears in the body text. Used for
   * content-complete digest assertions (one call per dynamic field).
   */
  assertBodyContains(body: RcFullMessage, ...fragments: string[]): void {
    const text = body.text_body ?? "";
    const missing = fragments.filter((f) => !text.includes(f));
    if (missing.length > 0) {
      throw new Error(
        `Email body missing expected fragments: ${JSON.stringify(missing)}.\n` +
          `Body text was:\n${text.slice(0, 2000)}`,
      );
    }
  }

  /**
   * Assert none of the forbidden fragments appear in the body text. Used as
   * the leakage-guard for digest content (data from non-APPROVED / non-tomorrow
   * records must not appear).
   */
  assertBodyMissing(body: RcFullMessage, ...fragments: string[]): void {
    const text = body.text_body ?? "";
    const leaked = fragments.filter((f) => text.includes(f));
    if (leaked.length > 0) {
      throw new Error(
        `Email body contains forbidden fragments: ${JSON.stringify(leaked)}.\n` +
          `Body text was:\n${text.slice(0, 2000)}`,
      );
    }
  }

  /**
   * Assert subject matches the regex. Pass as an anchored pattern to catch
   * prefix/suffix drift.
   */
  assertSubject(msg: RcMessage, pattern: RegExp): void {
    const subject = msg.subject ?? "";
    if (!pattern.test(subject)) {
      throw new Error(
        `Subject ${JSON.stringify(subject)} does not match ${pattern.toString()}`,
      );
    }
  }

  private appendSearchArgs(args: string[], opts: SearchOptions): void {
    if (opts.subject) args.push("--subject", opts.subject);
    if (opts.from) args.push("--from", opts.from);
    if (opts.to) args.push("--to", opts.to);
    if (opts.body) args.push("--body", opts.body);
    if (opts.since) args.push("--since", this.formatImapDate(opts.since));
    if (opts.before) args.push("--before", this.formatImapDate(opts.before));
    if (opts.limit != null) args.push("--limit", String(opts.limit));
    if (opts.offset != null) args.push("--offset", String(opts.offset));
    if (opts.mailbox) args.push("--mailbox", opts.mailbox);
  }

  private formatImapDate(d: Date): string {
    // IMAP date format: DD-Mmm-YYYY (e.g. 21-Apr-2026)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mmm = months[d.getUTCMonth()];
    const yyyy = d.getUTCFullYear();
    return `${dd}-${mmm}-${yyyy}`;
  }

  private isAfter(msg: RcMessage, threshold: Date): boolean {
    if (!msg.internal_date) return true;
    const msgTime = Date.parse(msg.internal_date);
    if (isNaN(msgTime)) return true;
    return msgTime >= threshold.getTime() - 60_000; // 1-min clock skew slack
  }

  private runCli(args: string[]): string {
    const result = spawnSync("python3", [this.scriptPath, ...args], {
      encoding: "utf8",
      timeout: 60_000,
    });
    if (result.status !== 0) {
      throw new Error(
        `roundcube_imap.py ${args.join(" ")} exited with ${result.status}:\n` +
          `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    }
    return result.stdout;
  }

  private findRepoRoot(): string {
    // Fixture runs inside autotests/e2e/fixtures/common/; repo root is 4 levels up.
    return path.resolve(__dirname, "..", "..", "..", "..");
  }
}

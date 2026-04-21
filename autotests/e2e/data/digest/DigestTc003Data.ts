import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { countApprovedTomorrow } from "./queries/digestQueries";

/**
 * TC-DIGEST-003: Digest (scheduler variant) — empty happy path.
 *
 * Data contract:
 *   • `precheckCount` — count of APPROVED vacations starting tomorrow at spec
 *     entry. The TC's ideal state is 0; when the env carries unrelated seed
 *     data the spec relaxes mailbox assertions but still asserts that the
 *     scheduler ran cleanly (start + finish + no ERROR).
 *
 * Rationale: making the spec forcibly cancel sibling-test state would be too
 * disruptive on shared envs, and the TC's regression value (scheduler handles
 * empty recipient set) still holds as long as the scheduler completes with no
 * error markers.
 */
export class DigestTc003Data {
  readonly precheckCount: number;

  constructor(precheckCount: number) {
    this.precheckCount = precheckCount;
  }

  static async create(tttConfig: TttConfig): Promise<DigestTc003Data> {
    const db = new DbClient(tttConfig);
    try {
      const count = await countApprovedTomorrow(db);
      return new DigestTc003Data(count);
    } finally {
      await db.close();
    }
  }
}

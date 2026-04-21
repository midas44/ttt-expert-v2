import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc001Data } from "./DigestTc001Data";

/**
 * TC-DIGEST-007: Digest (scheduler variant) — subject-format regex audit.
 *
 * Needs a single APPROVED-tomorrow vacation to drive delivery of one digest
 * email; body content is NOT asserted in this TC — only the envelope subject.
 * Delegates the entire seed contract to TC-001 because the precondition shape
 * is identical ("one APPROVED tomorrow vacation, any content").
 */
export class DigestTc007Data extends DigestTc001Data {
  static async create(tttConfig: TttConfig): Promise<DigestTc007Data> {
    const base = await DigestTc001Data.create(tttConfig);
    return new DigestTc007Data({
      seedLogin: base.seedLogin,
      seedEmail: base.seedEmail,
      seedRussianFirstName: base.seedRussianFirstName,
      seedRussianLastName: base.seedRussianLastName,
      seedLatinFirstName: base.seedLatinFirstName,
      seedLatinLastName: base.seedLatinLastName,
    });
  }

  override async seed(
    request: APIRequestContext,
    tttConfig: TttConfig,
  ): Promise<void> {
    await super.seed(request, tttConfig);
  }
}

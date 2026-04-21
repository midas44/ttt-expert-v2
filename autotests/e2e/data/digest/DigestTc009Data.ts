import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc001Data } from "./DigestTc001Data";

/**
 * TC-DIGEST-009: Digest (scheduler variant) — Graylog marker audit.
 *
 * Needs a single APPROVED-tomorrow vacation to drive a per-recipient marker
 * that the spec can match on by `<seed_email>` + `vacation id = <id>`. Body
 * content is NOT asserted in this TC — only the Graylog marker sequence.
 * Delegates the seed contract to TC-001.
 */
export class DigestTc009Data extends DigestTc001Data {
  static async create(tttConfig: TttConfig): Promise<DigestTc009Data> {
    const base = await DigestTc001Data.create(tttConfig);
    return new DigestTc009Data({
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

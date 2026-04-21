import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc001Data } from "./DigestTc001Data";

/**
 * TC-DIGEST-002: Digest (test-endpoint variant) — same seed shape as TC-001.
 *
 * The two variants are dual-trigger siblings (scheduler vs wrapper-bypass) but
 * consume identical preconditions: one APPROVED vacation starting tomorrow for
 * the seed recipient. Delegating to `DigestTc001Data` keeps the seed contract
 * consistent between variants and avoids divergent drift when the contract
 * evolves.
 */
export class DigestTc002Data extends DigestTc001Data {
  static async create(tttConfig: import("@ttt/config/tttConfig").TttConfig) {
    const base = await DigestTc001Data.create(tttConfig);
    return Object.assign(new DigestTc002Data({
      seedLogin: base.seedLogin,
      seedEmail: base.seedEmail,
      seedRussianFirstName: base.seedRussianFirstName,
      seedRussianLastName: base.seedRussianLastName,
      seedLatinFirstName: base.seedLatinFirstName,
      seedLatinLastName: base.seedLatinLastName,
    }), {});
  }

  override async seed(
    request: APIRequestContext,
    tttConfig: import("@ttt/config/tttConfig").TttConfig,
  ): Promise<void> {
    await super.seed(request, tttConfig);
  }
}

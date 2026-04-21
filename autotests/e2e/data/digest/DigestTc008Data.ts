import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc001Data } from "./DigestTc001Data";

/**
 * TC-DIGEST-008: Digest (test-endpoint variant) — subject-format regex audit.
 *
 * Same seed shape as TC-007 (one APPROVED-tomorrow vacation for any recipient);
 * differs only in trigger (test endpoint vs scheduler). Delegates to TC-001.
 */
export class DigestTc008Data extends DigestTc001Data {
  static async create(tttConfig: TttConfig): Promise<DigestTc008Data> {
    const base = await DigestTc001Data.create(tttConfig);
    return new DigestTc008Data({
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

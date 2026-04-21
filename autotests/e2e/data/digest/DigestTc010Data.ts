import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc001Data } from "./DigestTc001Data";

/**
 * TC-DIGEST-010: Digest (test-endpoint variant) — Graylog marker audit.
 *
 * Same seed as TC-009 (one APPROVED-tomorrow vacation for any recipient);
 * differs only in trigger (test endpoint vs scheduler). Delegates to TC-001.
 */
export class DigestTc010Data extends DigestTc001Data {
  static async create(tttConfig: TttConfig): Promise<DigestTc010Data> {
    const base = await DigestTc001Data.create(tttConfig);
    return new DigestTc010Data({
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

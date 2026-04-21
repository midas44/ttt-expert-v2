import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc005Data } from "./DigestTc005Data";

/**
 * TC-DIGEST-006: Digest (test-endpoint variant) — leakage guard. Delegates to
 * TC-005's seed contract because the two variants are dual-trigger siblings
 * (scheduler vs wrapper-bypass) on the same 4-vacation mixed seed:
 *
 *   • target APPROVED @ tomorrow
 *   • wrong-date APPROVED @ tomorrow+2
 *   • CANCELED @ tomorrow
 *   • REJECTED @ tomorrow
 *
 * Same caveat as TC-005: the "NEW tomorrow" leakage row is unreachable because
 * the API conflict rule (NEW/APPROVED) rejects it, so we test the 3 wrong-status
 * and 1 wrong-date candidates.
 */
export class DigestTc006Data extends DigestTc005Data {
  static async create(tttConfig: TttConfig): Promise<DigestTc006Data> {
    const base = await DigestTc005Data.create(tttConfig);
    return new DigestTc006Data({
      targetLogin: base.targetLogin,
      targetEmail: base.targetEmail,
      russianFirstName: base.russianFirstName,
      russianLastName: base.russianLastName,
      latinFirstName: base.latinFirstName,
      latinLastName: base.latinLastName,
    });
  }

  override async seed(
    request: APIRequestContext,
    tttConfig: TttConfig,
  ): Promise<void> {
    await super.seed(request, tttConfig);
  }
}

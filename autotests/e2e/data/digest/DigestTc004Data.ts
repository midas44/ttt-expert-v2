import type { TttConfig } from "@ttt/config/tttConfig";
import { DigestTc003Data } from "./DigestTc003Data";

/**
 * TC-DIGEST-004: Digest (test-endpoint variant) — empty happy path. Shares
 * the `precheckCount`-only data contract with TC-DIGEST-003 (scheduler
 * variant) because both variants react to the same DB state and differ only
 * in trigger mechanism.
 */
export class DigestTc004Data extends DigestTc003Data {
  static async create(tttConfig: TttConfig): Promise<DigestTc004Data> {
    const base = await DigestTc003Data.create(tttConfig);
    return new DigestTc004Data(base.precheckCount);
  }
}

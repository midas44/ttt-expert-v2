declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

interface Tc092Args {
  invalidIdUrl: string;
}

/**
 * TC-VAC-092: Invalid type parameter → type mismatch error.
 * API-only — sends string "abc" as vacation ID (expects Long).
 */
export class VacationTc092Data {
  readonly invalidIdUrl: string;

  constructor(args: Tc092Args) {
    this.invalidIdUrl = args.invalidIdUrl;
  }

  static async create(
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc092Data> {
    return new VacationTc092Data({
      invalidIdUrl: tttConfig.buildUrl("/api/vacation/v1/vacations/abc"),
    });
  }
}

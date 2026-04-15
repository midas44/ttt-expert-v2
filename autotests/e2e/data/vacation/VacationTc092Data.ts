declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";

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
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc092Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc092Args>("VacationTc092Data");
      if (cached) return new VacationTc092Data(cached);
    }
    const args: Tc092Args = {
      invalidIdUrl: tttConfig.buildUrl("/api/vacation/v1/vacations/abc"),
    };
    saveToDisk("VacationTc092Data", args);
    return new VacationTc092Data(args);
  }
}

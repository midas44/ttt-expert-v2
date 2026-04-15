declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";

interface Tc093Args {
  vacationsUrl: string;
}

/**
 * TC-VAC-093: Missing required fields → validation errors array.
 * API-only — POSTs empty JSON object {} to the vacations endpoint.
 */
export class VacationTc093Data {
  readonly vacationsUrl: string;

  constructor(args: Tc093Args) {
    this.vacationsUrl = args.vacationsUrl;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc093Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc093Args>("VacationTc093Data");
      if (cached) return new VacationTc093Data(cached);
    }
    const args: Tc093Args = {
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
    };
    saveToDisk("VacationTc093Data", args);
    return new VacationTc093Data(args);
  }
}

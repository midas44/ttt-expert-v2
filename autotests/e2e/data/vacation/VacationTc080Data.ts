declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";

interface Tc080Args {
  vacationsUrl: string;
}

/**
 * TC-VAC-080: Approver field missing from API (#3329).
 * API-only test — just needs the vacations list endpoint URL.
 */
export class VacationTc080Data {
  readonly vacationsUrl: string;

  constructor(args: Tc080Args) {
    this.vacationsUrl = args.vacationsUrl;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc080Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc080Args>("VacationTc080Data");
      if (cached) return new VacationTc080Data(cached);
    }
    const args: Tc080Args = {
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
    };
    saveToDisk("VacationTc080Data", args);
    return new VacationTc080Data(args);
  }
}

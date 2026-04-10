declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

interface Tc098Args {
  nonExistentVacationUrl: string;
}

/**
 * TC-VAC-098: Non-existent vacation ID → 404.
 * API-only — GETs a vacation ID that cannot exist (999999999).
 */
export class VacationTc098Data {
  readonly nonExistentVacationUrl: string;

  constructor(args: Tc098Args) {
    this.nonExistentVacationUrl = args.nonExistentVacationUrl;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc098Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc098Args>("VacationTc098Data");
      if (cached) return new VacationTc098Data(cached);
    }
    const args: Tc098Args = {
      nonExistentVacationUrl: tttConfig.buildUrl(
        "/api/vacation/v1/vacations/999999999",
      ),
    };
    saveToDisk("VacationTc098Data", args);
    return new VacationTc098Data(args);
  }
}

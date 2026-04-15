declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";

interface Tc091Args {
  apiUrl: string;
}

/**
 * TC-VAC-091: Empty request body → empty 400 response.
 * No dynamic data needed — just the API URL and token.
 * HttpMessageNotReadableException returns ResponseEntity<Void>.
 */
export class VacationTc091Data {
  readonly apiUrl: string;

  constructor(args: Tc091Args) {
    this.apiUrl = args.apiUrl;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc091Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc091Args>("VacationTc091Data");
      if (cached) return new VacationTc091Data(cached);
    }
    const args: Tc091Args = {
      apiUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
    };
    saveToDisk("VacationTc091Data", args);
    return new VacationTc091Data(args);
  }
}

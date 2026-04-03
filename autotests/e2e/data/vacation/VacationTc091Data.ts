declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

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
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc091Data> {
    return new VacationTc091Data({
      apiUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
    });
  }
}

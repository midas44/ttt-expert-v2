declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

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
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc093Data> {
    return new VacationTc093Data({
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
    });
  }
}

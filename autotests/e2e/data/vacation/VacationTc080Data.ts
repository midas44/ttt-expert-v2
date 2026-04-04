declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

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
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc080Data> {
    return new VacationTc080Data({
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
    });
  }
}

declare const process: { env: Record<string, string | undefined> };

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
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc098Data> {
    return new VacationTc098Data({
      nonExistentVacationUrl: tttConfig.buildUrl(
        "/api/vacation/v1/vacations/999999999",
      ),
    });
  }
}

declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

/**
 * TC-VAC-032: Auto-pay expired APPROVED vacations (cron).
 * Test endpoint: POST /api/vacation/v1/test/vacations/pay-expired-approved
 *
 * This test verifies the cron-like endpoint is accessible and functional.
 * Full verification (with actual expired APPROVED vacations) needs timemachine
 * env or clock manipulation to create past-date approved vacations.
 */
export class VacationTc032Data {
  readonly payExpiredUrl: string;
  readonly apiToken: string;

  constructor(tttConfig: TttConfig) {
    this.payExpiredUrl = tttConfig.buildUrl(
      "/api/vacation/v1/test/vacations/pay-expired-approved",
    );
    this.apiToken = tttConfig.apiToken;
  }

  static async create(
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc032Data> {
    return new VacationTc032Data(tttConfig);
  }
}

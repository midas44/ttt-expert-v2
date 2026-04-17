declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";

interface Tc032Args {
  payExpiredUrl: string;
  apiToken: string;
}

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

  constructor(args: Tc032Args) {
    this.payExpiredUrl = args.payExpiredUrl;
    this.apiToken = args.apiToken;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc032Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc032Args>("VacationTc032Data");
      if (cached) return new VacationTc032Data(cached);
    }
    const args: Tc032Args = {
      payExpiredUrl: tttConfig.buildUrl(
        "/api/vacation/v1/test/vacations/pay-expired-approved",
      ),
      apiToken: tttConfig.apiToken,
    };
    saveToDisk("VacationTc032Data", args);
    return new VacationTc032Data(args);
  }
}

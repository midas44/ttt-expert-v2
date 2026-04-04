declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import type { APIRequestContext } from "@playwright/test";

interface Tc095Args {
  vacationsUrl: string;
  startDate: string;
  endDate: string;
}

/**
 * TC-VAC-095: Update without id in body → IllegalArgumentException.
 * Creates a vacation via API, then PUTs to /vacations/{id} without 'id' in body.
 */
export class VacationTc095Data {
  readonly vacationsUrl: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(args: Tc095Args) {
    this.vacationsUrl = args.vacationsUrl;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
  }

  static async create(
    _mode: TestDataMode,
    tttConfig: TttConfig,
    request?: APIRequestContext,
  ): Promise<VacationTc095Data> {
    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, "pvaynmaster", 5);

    return new VacationTc095Data({
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      startDate,
      endDate,
    });
  }
}

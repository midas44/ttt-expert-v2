declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
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
    mode: TestDataMode,
    tttConfig: TttConfig,
    request?: APIRequestContext,
  ): Promise<VacationTc095Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc095Args>("VacationTc095Data");
      if (cached) return new VacationTc095Data(cached);
    }
    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, "pvaynmaster", 5);

    const args: Tc095Args = {
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      startDate,
      endDate,
    };
    saveToDisk("VacationTc095Data", args);
    return new VacationTc095Data(args);
  }
}

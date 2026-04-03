declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc027Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-027: Payment validation — wrong day sum rejected.
 * SETUP: API creates → approves a 5-day vacation.
 * Test: attempts payment with regularDaysPayed=3 (sum≠5) → expects 400.
 */
export class VacationTc027Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(
    username = process.env.VAC_TC027_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc027Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc027Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc027Args>("VacationTc027Data");
      if (cached) {
        return new VacationTc027Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 22);

    const args: Tc027Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
    };

    if (mode === "saved") saveToDisk("VacationTc027Data", args);
    return new VacationTc027Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
    );
  }
}

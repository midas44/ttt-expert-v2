declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc028Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-028: Cannot pay NEW vacation.
 * SETUP: API creates a vacation (stays NEW, not approved).
 * Test: attempts payment → expects 400 (status must be APPROVED).
 */
export class VacationTc028Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(
    username = process.env.VAC_TC028_USER ?? "pvaynmaster",
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
  ): Promise<VacationTc028Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc028Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc028Args>("VacationTc028Data");
      if (cached) {
        return new VacationTc028Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 24);

    const args: Tc028Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
    };

    saveToDisk("VacationTc028Data", args);
    return new VacationTc028Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
    );
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc030Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-030: Delete PAID+EXACT blocked.
 * SETUP: API creates → approves → pays a vacation (EXACT period).
 * Test: attempts DELETE → expects 400 with 'exception.vacation.delete.notAllowed'.
 */
export class VacationTc030Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(
    username = process.env.VAC_TC030_USER ?? "pvaynmaster",
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
  ): Promise<VacationTc030Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc030Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc030Args>("VacationTc030Data");
      if (cached) {
        return new VacationTc030Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 46);

    const args: Tc030Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
    };

    if (mode === "saved") saveToDisk("VacationTc030Data", args);
    return new VacationTc030Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
    );
  }
}

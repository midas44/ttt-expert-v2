declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc029Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-029: PAID vacation — terminal state, no further transitions.
 * SETUP: API creates → approves → pays a vacation (pvaynmaster is CPO, self-approves).
 * Test: attempts cancel, reject, update, delete — all should fail with 400/403.
 */
export class VacationTc029Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(
    username = process.env.VAC_TC029_USER ?? "pvaynmaster",
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
  ): Promise<VacationTc029Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc029Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc029Args>("VacationTc029Data");
      if (cached) {
        return new VacationTc029Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, username, 20);

    const args: Tc029Args = {
      username,
      startDateIso: startDate,
      endDateIso: endDate,
    };

    if (mode === "saved") saveToDisk("VacationTc029Data", args);
    return new VacationTc029Data(
      args.username,
      args.startDateIso,
      args.endDateIso,
    );
  }
}

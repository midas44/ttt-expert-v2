declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc096Args {
  vacationsUrl: string;
  login: string;
  weekADates: { startDate: string; endDate: string };
  weekBDates: { startDate: string; endDate: string };
}

/**
 * TC-VAC-096: Crossing validation error format inconsistency.
 * Creates vacation A, then:
 *   - POST overlapping vacation B → check error format (create endpoint)
 *   - Create non-overlapping vacation B, then PUT with overlapping dates → check error format (update)
 * Compares error format between create and update endpoints.
 */
export class VacationTc096Data {
  readonly vacationsUrl: string;
  readonly login: string;
  readonly weekADates: { startDate: string; endDate: string };
  readonly weekBDates: { startDate: string; endDate: string };

  constructor(args: Tc096Args) {
    this.vacationsUrl = args.vacationsUrl;
    this.login = args.login;
    this.weekADates = args.weekADates;
    this.weekBDates = args.weekBDates;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc096Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc096Args>("VacationTc096Data");
      if (cached) return new VacationTc096Data(cached);
    }
    // Find two non-conflicting weeks for the token owner
    const weekA = await ApiVacationSetupFixture.findAvailableWeek(
      tttConfig,
      "pvaynmaster",
      5,
    );
    const weekB = await ApiVacationSetupFixture.findAvailableWeek(
      tttConfig,
      "pvaynmaster",
      8,
    );

    const args: Tc096Args = {
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      login: "pvaynmaster",
      weekADates: weekA,
      weekBDates: weekB,
    };
    saveToDisk("VacationTc096Data", args);
    return new VacationTc096Data(args);
  }
}

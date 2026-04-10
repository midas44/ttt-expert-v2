declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";

interface Tc094Args {
  vacationsUrl: string;
  pastStartDate: string;
  pastEndDate: string;
  login: string;
}

/**
 * TC-VAC-094: Exception class leakage in error responses.
 * API-only — POSTs a vacation with past startDate to trigger a 400 error,
 * then checks whether the 'exception' field leaks the Java class name.
 */
export class VacationTc094Data {
  readonly vacationsUrl: string;
  readonly pastStartDate: string;
  readonly pastEndDate: string;
  readonly login: string;

  constructor(args: Tc094Args) {
    this.vacationsUrl = args.vacationsUrl;
    this.pastStartDate = args.pastStartDate;
    this.pastEndDate = args.pastEndDate;
    this.login = args.login;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc094Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc094Args>("VacationTc094Data");
      if (cached) return new VacationTc094Data(cached);
    }
    const args: Tc094Args = {
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      pastStartDate: "2020-01-06",
      pastEndDate: "2020-01-10",
      login: "pvaynmaster",
    };
    saveToDisk("VacationTc094Data", args);
    return new VacationTc094Data(args);
  }
}

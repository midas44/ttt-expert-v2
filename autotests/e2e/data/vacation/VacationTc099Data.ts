declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";

interface Tc099Args {
  vacationsUrl: string;
  login: string;
  startDate: string;
  endDate: string;
  paymentMonth: string;
}

/**
 * TC-VAC-099: Invalid notifyAlso login → 400.
 * POSTs a vacation with a nonexistent login in notifyAlso array.
 * @EmployeeLoginCollectionExists validates all logins exist.
 */
export class VacationTc099Data {
  readonly vacationsUrl: string;
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentMonth: string;

  constructor(args: Tc099Args) {
    this.vacationsUrl = args.vacationsUrl;
    this.login = args.login;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
    this.paymentMonth = args.paymentMonth;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc099Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc099Args>("VacationTc099Data");
      if (cached) return new VacationTc099Data(cached);
    }
    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, "pvaynmaster");
    const paymentMonth = `${startDate.slice(0, 8)}01`;

    const args: Tc099Args = {
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      login: "pvaynmaster",
      startDate,
      endDate,
      paymentMonth,
    };
    saveToDisk("VacationTc099Data", args);
    return new VacationTc099Data(args);
  }
}

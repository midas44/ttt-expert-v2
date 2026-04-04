declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

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
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc099Data> {
    const { startDate, endDate } =
      await ApiVacationSetupFixture.findAvailableWeek(tttConfig, "pvaynmaster");
    const paymentMonth = `${startDate.slice(0, 8)}01`;

    return new VacationTc099Data({
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      login: "pvaynmaster",
      startDate,
      endDate,
      paymentMonth,
    });
  }
}

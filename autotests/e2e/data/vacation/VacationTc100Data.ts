declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc100Args {
  vacationsUrl: string;
  login: string;
  apiToken: string;
  /** Three non-overlapping week ranges for concurrent requests */
  weeks: Array<{ startDate: string; endDate: string; paymentMonth: string }>;
}

/**
 * TC-VAC-100: Batch deadlock on concurrent operations.
 *
 * Sends 3 simultaneous vacation create requests for the same employee.
 * Root cause: employee_vacation table row contention during
 * VacationRecalculationServiceImpl FIFO redistribution.
 * Expected: at least 1 succeeds; others may get 500 (CannotAcquireLockException).
 */
export class VacationTc100Data {
  readonly vacationsUrl: string;
  readonly login: string;
  readonly apiToken: string;
  readonly weeks: Array<{
    startDate: string;
    endDate: string;
    paymentMonth: string;
  }>;

  constructor(args: Tc100Args) {
    this.vacationsUrl = args.vacationsUrl;
    this.login = args.login;
    this.apiToken = args.apiToken;
    this.weeks = args.weeks;
  }

  static async create(
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc100Data> {
    // Find 3 non-overlapping conflict-free weeks for pvaynmaster
    const login = "pvaynmaster";
    const weeks: Array<{
      startDate: string;
      endDate: string;
      paymentMonth: string;
    }> = [];

    // Start searching further ahead to avoid conflicts with other tests
    let weeksAhead = 30;
    for (let i = 0; i < 3; i++) {
      const { startDate, endDate } =
        await ApiVacationSetupFixture.findAvailableWeek(
          tttConfig,
          login,
          weeksAhead,
        );
      weeks.push({
        startDate,
        endDate,
        paymentMonth: `${startDate.slice(0, 8)}01`,
      });
      // Jump ahead to avoid overlap with the week we just found
      weeksAhead += 3;
    }

    return new VacationTc100Data({
      vacationsUrl: tttConfig.buildUrl("/api/vacation/v1/vacations"),
      login,
      apiToken: tttConfig.apiToken,
      weeks,
    });
  }
}

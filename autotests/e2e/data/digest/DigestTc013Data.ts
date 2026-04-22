import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import {
  getEmployeeDisplayInfo,
  formatRu,
  inclusiveDayCount,
  russianDayPluralWord,
} from "./queries/digestQueries";

/**
 * TC-DIGEST-013: cross-year boundary via the scheduler path.
 *
 * Seeding sequence (orchestrated by the spec — this class does not touch the
 * clock itself):
 *   1. Spec advances server clock to `<targetYear>-12-31T00:30:00` (safe early
 *      Monday morning — well before the 08:00 scheduler fire).
 *   2. Spec calls `seed(request, tttConfig, targetYear)` — vacation start
 *      becomes "tomorrow" from the server's point of view, so the API
 *      accepts a `<targetYear+1>-01-01` start date that is >2 years away
 *      from the real wall clock.
 *   3. Spec re-patches clock to `<targetYear>-12-31T07:59:55` (5 s before
 *      fire) and waits for the `@Scheduled` wrapper to run.
 *
 * `targetYear` is computed once at the top of the spec as the nearest future
 * Monday-Dec-31 (currently 2028), then passed in. Keeping the year injected
 * — rather than computed inside `seed()` — keeps the clock target and the
 * seeded vacation dates in lockstep, so a clock-arithmetic bug in one place
 * can't silently drift the other.
 */

export interface DigestTc013Args {
  seedLogin: string;
  seedEmail: string;
  seedRussianFirstName: string;
  seedRussianLastName: string;
  seedLatinFirstName: string;
  seedLatinLastName: string;
}

export class DigestTc013Data {
  readonly seedLogin: string;
  readonly seedEmail: string;
  readonly seedRussianFirstName: string;
  readonly seedRussianLastName: string;
  readonly seedLatinFirstName: string;
  readonly seedLatinLastName: string;

  /** Set by `seed()`. */
  vacationId: number | null = null;
  targetYear: number = 0;
  startDateIso: string = "";
  endDateIso: string = "";
  startDateDisplay: string = "";
  endDateDisplay: string = "";
  tomorrowDisplay: string = "";
  durationDays: number = 5;
  durationPhrase: string = "";
  createdBySetup: boolean = false;

  constructor(args: DigestTc013Args) {
    this.seedLogin = args.seedLogin;
    this.seedEmail = args.seedEmail;
    this.seedRussianFirstName = args.seedRussianFirstName;
    this.seedRussianLastName = args.seedRussianLastName;
    this.seedLatinFirstName = args.seedLatinFirstName;
    this.seedLatinLastName = args.seedLatinLastName;
  }

  static async create(tttConfig: TttConfig): Promise<DigestTc013Data> {
    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeDisplayInfo(db, "pvaynmaster");
      return new DigestTc013Data({
        seedLogin: info.login,
        seedEmail: info.email,
        seedRussianFirstName: info.russianFirstName,
        seedRussianLastName: info.russianLastName,
        seedLatinFirstName: info.latinFirstName,
        seedLatinLastName: info.latinLastName,
      });
    } finally {
      await db.close();
    }
  }

  async seed(
    request: APIRequestContext,
    tttConfig: TttConfig,
    targetYear: number,
  ): Promise<void> {
    this.targetYear = targetYear;
    const nextYear = targetYear + 1;
    const startIso = `${nextYear}-01-01`;
    const endIso = `${nextYear}-01-05`;

    const setup = new ApiVacationSetupFixture(request, tttConfig);
    const vac = await setup.createAndApprove(startIso, endIso, "REGULAR");
    this.vacationId = vac.id;
    this.startDateIso = startIso;
    this.endDateIso = endIso;
    this.createdBySetup = true;

    const startDate = new Date(startIso + "T12:00:00Z");
    const endDate = new Date(endIso + "T12:00:00Z");
    this.tomorrowDisplay = formatRu(startDate);
    this.startDateDisplay = formatRu(startDate);
    this.endDateDisplay = formatRu(endDate);
    this.durationDays = inclusiveDayCount(startIso, endIso);
    this.durationPhrase = `${this.durationDays} ${russianDayPluralWord(this.durationDays)}`;
  }

  async cleanup(
    request: APIRequestContext,
    tttConfig: TttConfig,
  ): Promise<void> {
    if (!this.createdBySetup || this.vacationId == null) return;
    const setup = new ApiVacationSetupFixture(request, tttConfig);
    await setup.deleteVacation(this.vacationId);
  }
}

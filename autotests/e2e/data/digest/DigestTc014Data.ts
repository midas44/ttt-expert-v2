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
 * TC-DIGEST-014: cross-year boundary via the test-endpoint path.
 *
 * Same seed shape as TC-DIGEST-013 — one 5-day REGULAR vacation starting
 * Jan 1 of the year after `targetYear`. The test-endpoint variant still
 * requires clock advance to Dec 31: the digest logic filters on server
 * `CURRENT_DATE`, and the test endpoint does not synthesise that value.
 * Time-of-day is immaterial because the scheduler wrapper (and therefore the
 * 08:00 fire window) is bypassed.
 */

export interface DigestTc014Args {
  seedLogin: string;
  seedEmail: string;
  seedRussianFirstName: string;
  seedRussianLastName: string;
  seedLatinFirstName: string;
  seedLatinLastName: string;
}

export class DigestTc014Data {
  readonly seedLogin: string;
  readonly seedEmail: string;
  readonly seedRussianFirstName: string;
  readonly seedRussianLastName: string;
  readonly seedLatinFirstName: string;
  readonly seedLatinLastName: string;

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

  constructor(args: DigestTc014Args) {
    this.seedLogin = args.seedLogin;
    this.seedEmail = args.seedEmail;
    this.seedRussianFirstName = args.seedRussianFirstName;
    this.seedRussianLastName = args.seedRussianLastName;
    this.seedLatinFirstName = args.seedLatinFirstName;
    this.seedLatinLastName = args.seedLatinLastName;
  }

  static async create(tttConfig: TttConfig): Promise<DigestTc014Data> {
    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeDisplayInfo(db, "pvaynmaster");
      return new DigestTc014Data({
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

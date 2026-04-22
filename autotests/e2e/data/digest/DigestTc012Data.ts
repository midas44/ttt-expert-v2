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
import { getServerClock, nextMondayDateIso } from "@utils/clockControl";

/**
 * TC-DIGEST-012: plural-form edge cases via the test-endpoint path.
 *
 * Same seeding shape and layout as TC-DIGEST-011 but runs against the real
 * server clock — the test endpoint bypasses the `@Scheduled` wrapper AND the
 * Monday gate (see TC-DIGEST-002 which works on any weekday). Seeds are still
 * anchored to the nearest future Monday so every start/end lands on a weekday
 * (`VacationCreateValidator` rejects purely-weekend spans with
 * `validation.vacation.duration`). The layout — V1 Tue, V2 Thu/Fri, V3
 * Mon–Fri, V4 Tue–Mon — keeps all four starts inside [today+1, today+21]
 * regardless of which weekday the spec runs on.
 *
 * The single-seed-identity adaptation from TC-DIGEST-011 applies here too:
 * one email to pvaynmaster aggregates all four vacations, so the spec can
 * sweep every plural branch in one body.
 *
 * V4 uses ADMINISTRATIVE payment (same as TC-DIGEST-011): after the 8-day
 * V1+V2+V3 run consumes part of pvaynmaster's REGULAR paid balance, the
 * 15-working-day V4 span fails `validation.vacation.duration` (paid-days
 * exhaustion) when seeded as REGULAR. `VacationCreateValidator` early-returns
 * for non-REGULAR payments so ADMINISTRATIVE bypasses the check. The digest
 * template renders payment type nowhere, so the plural-form sweep is valid.
 */

export interface DigestTc012Args {
  seedLogin: string;
  seedEmail: string;
  seedRussianFirstName: string;
  seedRussianLastName: string;
  seedLatinFirstName: string;
  seedLatinLastName: string;
}

export interface PluralSeed {
  vacationId: number;
  startIso: string;
  endIso: string;
  startDisplay: string;
  endDisplay: string;
  durationDays: number;
  durationPhrase: string;
}

export class DigestTc012Data {
  readonly seedLogin: string;
  readonly seedEmail: string;
  readonly seedRussianFirstName: string;
  readonly seedRussianLastName: string;
  readonly seedLatinFirstName: string;
  readonly seedLatinLastName: string;

  readonly seeds: PluralSeed[] = [];
  tomorrowDisplay: string = "";
  createdBySetup: boolean = false;

  constructor(args: DigestTc012Args) {
    this.seedLogin = args.seedLogin;
    this.seedEmail = args.seedEmail;
    this.seedRussianFirstName = args.seedRussianFirstName;
    this.seedRussianLastName = args.seedRussianLastName;
    this.seedLatinFirstName = args.seedLatinFirstName;
    this.seedLatinLastName = args.seedLatinLastName;
  }

  static async create(tttConfig: TttConfig): Promise<DigestTc012Data> {
    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeDisplayInfo(db, "pvaynmaster");
      return new DigestTc012Data({
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
  ): Promise<void> {
    const serverTime = await getServerClock(request, tttConfig);
    const mondayIso = nextMondayDateIso(serverTime);
    const monday = new Date(mondayIso + "T00:00:00Z");

    this.tomorrowDisplay = formatRu(addDaysUtc(monday, 1));

    const plan: Array<{
      offsetStart: number;
      offsetEnd: number;
      paymentType: "REGULAR" | "ADMINISTRATIVE";
    }> = [
      { offsetStart: 1, offsetEnd: 1, paymentType: "REGULAR" },
      { offsetStart: 3, offsetEnd: 4, paymentType: "REGULAR" },
      { offsetStart: 7, offsetEnd: 11, paymentType: "REGULAR" },
      { offsetStart: 15, offsetEnd: 35, paymentType: "ADMINISTRATIVE" },
    ];

    const setup = new ApiVacationSetupFixture(request, tttConfig);
    for (const p of plan) {
      const startIso = isoDateOffset(monday, p.offsetStart);
      const endIso = isoDateOffset(monday, p.offsetEnd);
      const vac = await setup.createAndApprove(startIso, endIso, p.paymentType);
      const days = inclusiveDayCount(startIso, endIso);
      this.seeds.push({
        vacationId: vac.id,
        startIso,
        endIso,
        startDisplay: formatRu(new Date(startIso + "T12:00:00Z")),
        endDisplay: formatRu(new Date(endIso + "T12:00:00Z")),
        durationDays: days,
        durationPhrase: `${days} ${russianDayPluralWord(days)}`,
      });
    }
    this.createdBySetup = true;
  }

  async cleanup(
    request: APIRequestContext,
    tttConfig: TttConfig,
  ): Promise<void> {
    if (!this.createdBySetup) return;
    const setup = new ApiVacationSetupFixture(request, tttConfig);
    for (const s of this.seeds) {
      await setup.deleteVacation(s.vacationId).catch(() => {});
    }
  }
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(d.getUTCDate() + days);
  return out;
}

function isoDateOffset(base: Date, offsetDays: number): string {
  const d = addDaysUtc(base, offsetDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

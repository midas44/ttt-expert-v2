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
 * TC-DIGEST-011: plural-form edge cases via the scheduler path.
 *
 * Authoring adaptation: the XLSX calls for 4 *distinct* employees each with a
 * single vacation of duration 1/2/5/21 days. `ApiVacationSetupFixture` can
 * only seed for the API-token owner (`pvaynmaster`) — there is no JWT issuer
 * for arbitrary users, so cross-employee seeding is impossible without DB
 * mutations. We preserve the test's essence (does the Russian plural
 * formatter render every branch correctly?) by seeding 4 *non-overlapping*
 * vacations for pvaynmaster, all starting inside the patched-clock
 * `[nextMonday+1, nextMonday+21]` window. The digest aggregates all upcoming
 * vacations for a recipient into a single email, so every plural branch
 * appears in one body — the content-complete assertion becomes a regex sweep
 * over that single body instead of four separate inboxes.
 *
 * Non-overlap layout (T = patched Monday = CURRENT_DATE after clock patch).
 * All start/end dates fall on weekdays to satisfy `VacationCreateValidator`
 * (`validation.vacation.duration`): a REGULAR vacation must have ≥ 1 working
 * day. Purely-weekend spans are rejected even when the calendar-day count is
 * positive, so naive `+3/+6/+12` offsets from Monday do not work.
 *
 *   V1: T+1  Tue → T+1  Tue  REGULAR        (1 cal, 1 work-day  → `1 день`)
 *   V2: T+3  Thu → T+4  Fri  REGULAR        (2 cal, 2 work-days → `2 дня`)
 *   V3: T+7  Mon → T+11 Fri  REGULAR        (5 cal, 5 work-days → `5 дней`)
 *   V4: T+15 Tue → T+35 Mon  ADMINISTRATIVE (21 cal, 15 work    → `21 день`)
 *
 * All four starts land inside [T+1, T+21] so every row is picked up by
 * `DigestServiceImpl.addSoonVacationEvents`. V4's end date exceeds the window
 * but the window filter is start-date based — irrelevant for inclusion.
 * V4 uses ADMINISTRATIVE payment so the 15-working-day span does not exhaust
 * pvaynmaster's REGULAR paid balance; `VacationCreateValidator` early-returns
 * for non-REGULAR payments so the `validation.vacation.duration` check is
 * bypassed. The digest template renders payment type nowhere in the body, so
 * the plural-form sweep is still valid.
 */

export interface DigestTc011Args {
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

export class DigestTc011Data {
  readonly seedLogin: string;
  readonly seedEmail: string;
  readonly seedRussianFirstName: string;
  readonly seedRussianLastName: string;
  readonly seedLatinFirstName: string;
  readonly seedLatinLastName: string;

  readonly seeds: PluralSeed[] = [];
  tomorrowDisplay: string = "";
  createdBySetup: boolean = false;

  constructor(args: DigestTc011Args) {
    this.seedLogin = args.seedLogin;
    this.seedEmail = args.seedEmail;
    this.seedRussianFirstName = args.seedRussianFirstName;
    this.seedRussianLastName = args.seedRussianLastName;
    this.seedLatinFirstName = args.seedLatinFirstName;
    this.seedLatinLastName = args.seedLatinLastName;
  }

  static async create(tttConfig: TttConfig): Promise<DigestTc011Data> {
    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeDisplayInfo(db, "pvaynmaster");
      return new DigestTc011Data({
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

  /**
   * Seed the 4 plural-branch vacations in the patched-clock `[M+1, M+21]`
   * window. Must run after the clock has been advanced to nextMonday early
   * morning so the vacation API accepts the start dates as "near future".
   * Populates `seeds[]` in the same order as the duration layout above.
   */
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

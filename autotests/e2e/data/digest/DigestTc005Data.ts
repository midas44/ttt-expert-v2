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
 * TC-DIGEST-005: Digest (scheduler variant) — leakage guard.
 *
 * Seeds 4 vacations for the same target employee (pvaynmaster — the API token
 * owner, the only identity under which `ApiVacationSetupFixture` can act):
 *
 *   • v1 (target): REGULAR, start = patchedTomorrow (nextMonday+1), APPROVED —
 *     MUST appear. Lands inside the digest window `[today+1, today+21]`.
 *   • v2: REGULAR, start = patchedTomorrow + 22 days (nextMonday+23), APPROVED
 *     — wrong-date leakage candidate (MUST NOT appear). Lands OUTSIDE the
 *     21-day window so `findSoonVacations` skips it.
 *   • v3: REGULAR, start = patchedTomorrow, then CANCELED — wrong-status
 *     leakage candidate (MUST NOT appear).
 *   • v4: REGULAR, start = patchedTomorrow, then REJECTED — wrong-status
 *     leakage candidate (MUST NOT appear).
 *
 * Date alignment with patched clock: the spec patches the server clock to
 * `nextMonday at 07:59:55` (see `fireSoonIso`). The 08:00 digest fires on
 * Monday and `addSoonVacationEvents` runs only on Monday over the
 * `[today+1, today+21]` window. We therefore key all dates off `nextMonday`.
 *
 * Note: we skip the NEW-tomorrow leakage candidate from the manifest. The API
 * creation conflict check (status IN ('NEW','APPROVED')) makes "NEW tomorrow"
 * mutually exclusive with "APPROVED tomorrow" for the same employee, so the
 * scenario is unreachable via the supported seeding API. The 3 remaining
 * wrong-status and 1 wrong-date candidates still cover the leakage surface.
 *
 * Order matters: CANCELED / REJECTED seeds are created and transitioned FIRST
 * (while no APPROVED-tomorrow exists to trigger a conflict), then the target
 * APPROVED-tomorrow is created last.
 */

export interface DigestTc005SeedIds {
  targetVacationId: number;
  wrongDateVacationId: number;
  canceledVacationId: number;
  rejectedVacationId: number;
}

export class DigestTc005Data {
  readonly targetLogin: string;
  readonly targetEmail: string;
  readonly russianFirstName: string;
  readonly russianLastName: string;
  readonly latinFirstName: string;
  readonly latinLastName: string;

  /** Populated by `seed()`. */
  tomorrowIso: string = "";
  tomorrowDisplay: string = "";
  wrongDateIso: string = "";
  wrongDateDisplay: string = "";
  targetStartDisplay: string = "";
  targetEndDisplay: string = "";
  targetDurationDays: number = 1;
  targetDurationPhrase: string = "";
  seededIds: DigestTc005SeedIds | null = null;

  constructor(args: {
    targetLogin: string;
    targetEmail: string;
    russianFirstName: string;
    russianLastName: string;
    latinFirstName: string;
    latinLastName: string;
  }) {
    this.targetLogin = args.targetLogin;
    this.targetEmail = args.targetEmail;
    this.russianFirstName = args.russianFirstName;
    this.russianLastName = args.russianLastName;
    this.latinFirstName = args.latinFirstName;
    this.latinLastName = args.latinLastName;
  }

  static async create(tttConfig: TttConfig): Promise<DigestTc005Data> {
    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeDisplayInfo(db, "pvaynmaster");
      return new DigestTc005Data({
        targetLogin: info.login,
        targetEmail: info.email,
        russianFirstName: info.russianFirstName,
        russianLastName: info.russianLastName,
        latinFirstName: info.latinFirstName,
        latinLastName: info.latinLastName,
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
    const tomorrowDate = addDaysIsoToDate(mondayIso, 1);
    const wrongDateDate = addDaysIsoToDate(mondayIso, 23);

    this.tomorrowIso = isoFromDate(tomorrowDate);
    this.tomorrowDisplay = formatRu(tomorrowDate);
    this.wrongDateIso = isoFromDate(wrongDateDate);
    this.wrongDateDisplay = formatRu(wrongDateDate);

    const setup = new ApiVacationSetupFixture(request, tttConfig);

    // 1. CANCELED tomorrow — create NEW then cancel (no approval conflict yet).
    const canceled = await setup.createAndCancel(
      this.tomorrowIso,
      this.tomorrowIso,
      "REGULAR",
    );
    // 2. REJECTED tomorrow — create NEW then reject.
    const rejected = await setup.createAndReject(
      this.tomorrowIso,
      this.tomorrowIso,
      "REGULAR",
    );
    // 3. Target APPROVED tomorrow — conflicts with NEW/APPROVED only; the
    //    CANCELED / REJECTED seeds no longer block.
    const target = await setup.createAndApprove(
      this.tomorrowIso,
      this.tomorrowIso,
      "REGULAR",
    );
    // 4. Wrong-date APPROVED — also different start_date, no conflict.
    const wrongDateVac = await setup.createAndApprove(
      this.wrongDateIso,
      this.wrongDateIso,
      "REGULAR",
    );

    this.seededIds = {
      targetVacationId: target.id,
      wrongDateVacationId: wrongDateVac.id,
      canceledVacationId: canceled.id,
      rejectedVacationId: rejected.id,
    };

    this.targetStartDisplay = formatRu(tomorrowDate);
    this.targetEndDisplay = this.targetStartDisplay;
    this.targetDurationDays = inclusiveDayCount(this.tomorrowIso, this.tomorrowIso);
    this.targetDurationPhrase = `${this.targetDurationDays} ${russianDayPluralWord(this.targetDurationDays)}`;
  }

  async cleanup(
    request: APIRequestContext,
    tttConfig: TttConfig,
  ): Promise<void> {
    if (!this.seededIds) return;
    const setup = new ApiVacationSetupFixture(request, tttConfig);
    const ids = [
      this.seededIds.targetVacationId,
      this.seededIds.wrongDateVacationId,
      this.seededIds.canceledVacationId,
      this.seededIds.rejectedVacationId,
    ];
    for (const id of ids) {
      try {
        await setup.deleteVacation(id);
      } catch {
        // best-effort cleanup — swallow per-id errors so the rest still runs
      }
    }
    this.seededIds = null;
  }
}

function addDaysIsoToDate(iso: string, days: number): Date {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

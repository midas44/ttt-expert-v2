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
 * TC-DIGEST-001: Digest (scheduler variant) — APPROVED vacation in the
 * digest-window, content-complete email.
 *
 * Data contract:
 *   • Seed login, email, Russian + Latin display names — drives subject /
 *     greeting / per-employee-block assertions.
 *   • Vacation id + date range (ISO + DD.MM.YYYY forms) — drives per-recipient
 *     marker and body-date assertions.
 *   • `createdBySetup` lets the spec cleanup only what it created.
 *
 * Date alignment with patched clock: the spec patches the server clock to
 * `nextMonday at 07:59:55` (see `fireSoonIso`) so the daily 08:00 digest
 * fires on a Monday — `DigestServiceImpl.addSoonVacationEvents` is gated on
 * `today.getDayOfWeek() == MONDAY` and processes vacations in the
 * `[today+1, today+21]` window. We therefore seed on `nextMonday+1` (the
 * Tuesday after the patched fire day), which lands inside that window
 * regardless of which weekday the spec is invoked on.
 *
 * The seed login is pvaynmaster (the API token owner) — the only identity
 * `ApiVacationSetupFixture` can create vacations for. We deliberately skip the
 * "reuse an existing APPROVED-tomorrow vacation" optimisation because such a
 * vacation would be keyed to real-clock tomorrow, not the patched-clock window.
 */

export interface DigestTc001Args {
  seedLogin: string;
  seedEmail: string;
  seedRussianFirstName: string;
  seedRussianLastName: string;
  seedLatinFirstName: string;
  seedLatinLastName: string;
}

export class DigestTc001Data {
  readonly seedLogin: string;
  readonly seedEmail: string;
  readonly seedRussianFirstName: string;
  readonly seedRussianLastName: string;
  readonly seedLatinFirstName: string;
  readonly seedLatinLastName: string;

  /** Set by `seed()`. */
  vacationId: number | null = null;
  startDateIso: string = "";
  endDateIso: string = "";
  startDateDisplay: string = "";
  endDateDisplay: string = "";
  tomorrowDisplay: string = "";
  durationDays: number = 1;
  durationPhrase: string = "";
  createdBySetup: boolean = false;

  constructor(args: DigestTc001Args) {
    this.seedLogin = args.seedLogin;
    this.seedEmail = args.seedEmail;
    this.seedRussianFirstName = args.seedRussianFirstName;
    this.seedRussianLastName = args.seedRussianLastName;
    this.seedLatinFirstName = args.seedLatinFirstName;
    this.seedLatinLastName = args.seedLatinLastName;
  }

  /**
   * Resolve the seed recipient identity (always pvaynmaster — token owner).
   * Does not yet create any vacation — vacation creation needs an
   * `APIRequestContext` and therefore runs inside the spec via `seed()`.
   */
  static async create(tttConfig: TttConfig): Promise<DigestTc001Data> {
    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeDisplayInfo(db, "pvaynmaster");
      return new DigestTc001Data({
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
   * Create an APPROVED vacation for the seed login on `nextMonday + 1 day`,
   * then record its dates on the data class for body assertions. The date is
   * computed from the *current* (un-patched) server clock so it remains valid
   * after the spec patches the clock to nextMonday — the seed lives inside
   * the patched-clock `[today+1, today+21]` window the digest scans.
   */
  async seed(
    request: APIRequestContext,
    tttConfig: TttConfig,
  ): Promise<void> {
    const serverTime = await getServerClock(request, tttConfig);
    const seedDateIso = addOneDayIso(nextMondayDateIso(serverTime));
    const seedDate = isoToDate(seedDateIso);

    const setup = new ApiVacationSetupFixture(request, tttConfig);
    const vac = await setup.createAndApprove(
      seedDateIso,
      seedDateIso,
      "REGULAR",
    );
    this.vacationId = vac.id;
    this.startDateIso = seedDateIso;
    this.endDateIso = seedDateIso;
    this.createdBySetup = true;

    this.tomorrowDisplay = formatRu(seedDate);
    this.startDateDisplay = formatRu(seedDate);
    this.endDateDisplay = formatRu(seedDate);
    this.durationDays = inclusiveDayCount(this.startDateIso, this.endDateIso);
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

function addOneDayIso(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string): Date {
  return new Date(iso + "T12:00:00Z");
}

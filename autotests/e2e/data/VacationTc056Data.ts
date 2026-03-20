declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-056: Approve with crossing vacation — blocked.
 *
 * Creates two vacations with overlapping dates. Approves B first,
 * then attempts to approve A — expects crossing error at approval.
 * Tests that checkVacation re-validates crossing on approve (checkForCrossing=true).
 */
export class VacationTc056Data {
  readonly login: string;
  readonly startDateA: string;
  readonly endDateA: string;
  readonly startDateB: string;
  readonly endDateB: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonthA: string;
  readonly paymentMonthB: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly approveEndpoint = "/api/vacation/v1/vacations/approve";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc056Data> {
    if (mode === "static") return new VacationTc056Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const dates = await VacationTc056Data.findOverlappingWindow(db, login, 230);
      return new VacationTc056Data(
        login,
        dates.startA, dates.endA,
        dates.startB, dates.endB,
      );
    } finally {
      await db.close();
    }
  }

  /**
   * Find a 2-week window with no existing conflicts, then define:
   * A: Mon1-Fri1 (week 1 Mon-Fri)
   * B: Wed1-Tue2 (Wed of week 1 to Tue of week 2) — overlaps Wed1-Fri1
   */
  private static async findOverlappingWindow(
    db: DbClient,
    login: string,
    startWeekOffset: number,
  ): Promise<{ startA: string; endA: string; startB: string; endB: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 24; attempt++) {
      const mon1 = new Date(monday);
      mon1.setDate(monday.getDate() + attempt * 14);
      const fri1 = new Date(mon1);
      fri1.setDate(mon1.getDate() + 4);
      const wed1 = new Date(mon1);
      wed1.setDate(mon1.getDate() + 2);
      const tue2 = new Date(mon1);
      tue2.setDate(mon1.getDate() + 8);

      const startA = toIso(mon1);
      const endA = toIso(fri1);
      const startB = toIso(wed1);
      const endB = toIso(tue2);

      const conflict = await hasVacationConflict(db, login, startA, endB);
      if (!conflict) {
        return { startA, endA, startB, endB };
      }
    }
    throw new Error(
      `No conflict-free overlapping window for "${login}" from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC056_LOGIN ?? "pvaynmaster",
    startDateA = process.env.VACATION_TC056_START_A ?? "2031-03-03",
    endDateA = process.env.VACATION_TC056_END_A ?? "2031-03-07",
    startDateB = process.env.VACATION_TC056_START_B ?? "2031-03-05",
    endDateB = process.env.VACATION_TC056_END_B ?? "2031-03-11",
  ) {
    this.login = login;
    this.startDateA = startDateA;
    this.endDateA = endDateA;
    this.startDateB = startDateB;
    this.endDateB = endDateB;
    this.paymentMonthA = startDateA.slice(0, 7) + "-01";
    this.paymentMonthB = startDateB.slice(0, 7) + "-01";
  }

  buildCreateBodyA(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDateA,
      endDate: this.endDateA,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonthA,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  buildCreateBodyB(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDateB,
      endDate: this.endDateB,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonthB,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

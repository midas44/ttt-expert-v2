declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findApprovedRequestWithCalendarDay,
  createApprovedRequestForCalendarTest,
} from "./queries/dayoffQueries";

interface Tc033Args {
  requestId: number;
  employeeId: number;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  calendarId: number;
  officeId: number;
}

/**
 * TC-DO-033: Path A — Calendar day moved, transfer request follows.
 *
 * Finds or creates an APPROVED transfer request whose original_date matches
 * a production calendar day. The test will create a new calendar holiday
 * on a future working day for the same office, triggering Path A cascade
 * (CalendarChangedApplicationEvent → CalendarUpdateProcessorImpl.processDay).
 */
export class DayoffTc033Data {
  readonly requestId: number;
  readonly employeeId: number;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly calendarId: number;
  readonly officeId: number;

  constructor(args: Tc033Args) {
    this.requestId = args.requestId;
    this.employeeId = args.employeeId;
    this.employeeLogin = args.employeeLogin;
    this.employeeName = args.employeeName;
    this.originalDate = args.originalDate;
    this.personalDate = args.personalDate;
    this.calendarId = args.calendarId;
    this.officeId = args.officeId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc033Data> {
    const defaults: Tc033Args = {
      requestId: 0,
      employeeId: 0,
      employeeLogin: process.env.DAYOFF_TC033_EMPLOYEE ?? "ogribanova",
      employeeName: "Грибанова Ольга",
      originalDate: "2026-05-01",
      personalDate: "2026-07-07",
      calendarId: 1,
      officeId: 1,
    };
    if (mode === "static") return new DayoffTc033Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc033Args>("DayoffTc033Data");
      if (cached) return new DayoffTc033Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      let row: Tc033Args;
      try {
        row = await findApprovedRequestWithCalendarDay(db);
      } catch {
        row = await createApprovedRequestForCalendarTest(db);
      }

      if (mode === "saved") saveToDisk("DayoffTc033Data", row);
      return new DayoffTc033Data(row);
    } finally {
      await db.close();
    }
  }

  /**
   * Returns a future working day (not weekend, not existing holiday) that can
   * be temporarily added as a holiday to trigger Path A cascade.
   * Computed relative to the personal_date of the transfer request.
   */
  get testHolidayDate(): string {
    const base = new Date(this.personalDate + "T12:00:00Z");
    // Pick a date 2 days after personal_date (should be a weekday)
    const target = new Date(base);
    target.setUTCDate(base.getUTCDate() + 2);
    // Skip weekends
    while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    return target.toISOString().slice(0, 10);
  }
}

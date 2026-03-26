declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithDayOffRequest,
  findFreeHolidayForTransfer,
  findFutureWorkingDay,
} from "./queries/dayoffQueries";

interface Tc012Args {
  username: string;
  newOriginalDate: string;
  newPersonalDate: string;
  regularDate: string;
  requestId: number | null;
  needsApiSetup: boolean;
}

/**
 * TC-DO-012: Cancel button only on NEW status rows.
 *
 * Finds an employee with a NEW transfer request (arrow row with cancel button)
 * plus a regular holiday row (no transfer — should NOT have cancel button).
 */
export class DayoffTc012Data {
  readonly username: string;
  readonly newOriginalDate: string;
  readonly newPersonalDate: string;
  readonly regularDate: string;
  readonly requestId: number | null;
  readonly needsApiSetup: boolean;

  constructor(
    username = process.env.DAYOFF_TC012_USER ?? "trikhter",
    newOriginalDate = process.env.DAYOFF_TC012_ORIG ?? "2026-06-01",
    newPersonalDate = process.env.DAYOFF_TC012_PERS ?? "2026-06-15",
    regularDate = process.env.DAYOFF_TC012_REG ?? "2026-05-01",
    requestId: number | null = null,
    needsApiSetup = true,
  ) {
    this.username = username;
    this.newOriginalDate = newOriginalDate;
    this.newPersonalDate = newPersonalDate;
    this.regularDate = regularDate;
    this.requestId = requestId;
    this.needsApiSetup = needsApiSetup;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc012Data> {
    if (mode === "static") return new DayoffTc012Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc012Args>("DayoffTc012Data");
      if (cached)
        return new DayoffTc012Data(
          cached.username,
          cached.newOriginalDate,
          cached.newPersonalDate,
          cached.regularDate,
          cached.requestId,
          cached.needsApiSetup,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const existing = await findEmployeeWithDayOffRequest(db, "NEW").catch(
        () => null,
      );

      if (existing) {
        // Find a regular (non-transfer) holiday for the same employee
        const regular = await db.queryOne<{ calendar_date: string }>(
          `SELECT cd.calendar_date::text
           FROM ttt_calendar.calendar_days cd
           JOIN ttt_calendar.office_calendar oc ON oc.calendar_id = cd.calendar_id
           JOIN ttt_vacation.employee e ON e.office_id = oc.office_id
           WHERE e.login = $1
             AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
             AND cd.calendar_date != $2
             AND NOT EXISTS (
               SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
               WHERE edr.employee = e.id
                 AND edr.original_date = cd.calendar_date
                 AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
             )
           ORDER BY cd.calendar_date
           LIMIT 1`,
          [existing.login, existing.original_date],
        );

        const instance = new DayoffTc012Data(
          existing.login,
          existing.original_date,
          existing.personal_date,
          regular.calendar_date,
          existing.request_id,
          false,
        );
        if (mode === "saved")
          saveToDisk("DayoffTc012Data", {
            username: existing.login,
            newOriginalDate: existing.original_date,
            newPersonalDate: existing.personal_date,
            regularDate: regular.calendar_date,
            requestId: existing.request_id,
            needsApiSetup: false,
          });
        return instance;
      }

      // No existing NEW request — find data for creation
      const row = await findFreeHolidayForTransfer(db);
      const target = await findFutureWorkingDay(db, row.login, row.public_date);

      const regular = await db.queryOne<{ calendar_date: string }>(
        `SELECT cd.calendar_date::text
         FROM ttt_calendar.calendar_days cd
         JOIN ttt_calendar.office_calendar oc ON oc.calendar_id = cd.calendar_id
         JOIN ttt_vacation.employee e ON e.office_id = oc.office_id
         WHERE e.login = $1
           AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
           AND cd.calendar_date != $2
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
             WHERE edr.employee = e.id
               AND edr.original_date = cd.calendar_date
               AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
           )
         ORDER BY cd.calendar_date
         LIMIT 1`,
        [row.login, row.public_date],
      );

      const instance = new DayoffTc012Data(
        row.login,
        row.public_date,
        target,
        regular.calendar_date,
        null,
        true,
      );
      if (mode === "saved")
        saveToDisk("DayoffTc012Data", {
          username: row.login,
          newOriginalDate: row.public_date,
          newPersonalDate: target,
          regularDate: regular.calendar_date,
          requestId: null,
          needsApiSetup: true,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  get newOriginalDateDisplay(): string {
    const [y, m, d] = this.newOriginalDate.split("-");
    return `${d}.${m}.${y}`;
  }

  get newPersonalDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.newPersonalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }

  get regularDateDisplay(): string {
    const [y, m, d] = this.regularDate.split("-");
    return `${d}.${m}.${y}`;
  }
}

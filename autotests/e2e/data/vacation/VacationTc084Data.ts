declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findAvailableWeekFromServer } from "./queries/vacationNotificationQueries";

interface Tc084Args {
  employeeLogin: string;
  employeeEmail: string;
  startDate1: string;
  endDate1: string;
  startDate2: string;
  endDate2: string;
  officeId: number;
  calendarId: number;
}

/**
 * TC-VAC-084: Regression — Calendar change converts ALL vacations (#3338).
 * Creates two approved vacations for an employee, modifies the production
 * calendar for a date within one vacation, then checks if only the affected
 * vacation gets reconverted or if ALL vacations are incorrectly affected.
 *
 * Bug #3338 (CLOSED): Calendar change should only affect the vacation
 * containing the changed date, not all employee vacations.
 */
export class VacationTc084Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly startDate1: string;
  readonly endDate1: string;
  readonly startDate2: string;
  readonly endDate2: string;
  readonly officeId: number;
  readonly calendarId: number;

  constructor(args: Tc084Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.startDate1 = args.startDate1;
    this.endDate1 = args.endDate1;
    this.startDate2 = args.startDate2;
    this.endDate2 = args.endDate2;
    this.officeId = args.officeId;
    this.calendarId = args.calendarId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc084Data> {
    const defaults: Tc084Args = {
      employeeLogin: process.env.VAC_TC084_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      startDate1: "2026-08-17",
      endDate1: "2026-08-21",
      startDate2: "2026-09-14",
      endDate2: "2026-09-18",
      officeId: 1,
      calendarId: 1,
    };
    if (mode === "static") return new VacationTc084Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc084Args>("VacationTc084Data");
      if (cached) return new VacationTc084Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Get pvaynmaster's office and calendar info
      // Calendar mapping is in ttt_calendar.office_calendar, not in ttt_vacation.office
      const empInfo = await db.queryOne<{
        login: string;
        email: string;
        office_id: number;
        calendar_id: number;
      }>(
        `SELECT e.login, e.email,
                e.office_id,
                oc.calendar_id
         FROM ttt_vacation.employee e
         JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
         WHERE e.login = 'pvaynmaster'
         LIMIT 1`,
      );

      // Find two non-overlapping weeks far enough in the future
      const week1 = await findAvailableWeekFromServer(
        db, empInfo.login, 14, 20,
      );
      const week2 = await findAvailableWeekFromServer(
        db, empInfo.login, 18, 20,
      );

      const args: Tc084Args = {
        employeeLogin: empInfo.login,
        employeeEmail: empInfo.email,
        startDate1: week1.startDate,
        endDate1: week1.endDate,
        startDate2: week2.startDate,
        endDate2: week2.endDate,
        officeId: empInfo.office_id,
        calendarId: empInfo.calendar_id,
      };

      saveToDisk("VacationTc084Data", args);
      return new VacationTc084Data(args);
    } finally {
      await db.close();
    }
  }
}

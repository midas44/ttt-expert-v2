declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc070Args {
  employeeLogin: string;
  employeeEmail: string;
  startDate1: string;
  endDate1: string;
  startDate2: string;
  endDate2: string;
}

/**
 * TC-VAC-070: Notification on auto-conversion to ADMINISTRATIVE (#3015).
 * Creates two REGULAR vacations for an employee in an AV=false office.
 * The second vacation may trigger auto-conversion of the first (later payment month)
 * from REGULAR to ADMINISTRATIVE due to accrued days validation.
 * Verifies notification email about the conversion.
 *
 * Note: This test checks whether the notification is sent when conversion happens.
 * Bug #3015-30 was about silent conversion (no notification). It was reportedly fixed.
 */
export class VacationTc070Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly startDate1: string;
  readonly endDate1: string;
  readonly startDate2: string;
  readonly endDate2: string;

  constructor(args: Tc070Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.startDate1 = args.startDate1;
    this.endDate1 = args.endDate1;
    this.startDate2 = args.startDate2;
    this.endDate2 = args.endDate2;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc070Data> {
    const defaults: Tc070Args = {
      employeeLogin: process.env.VAC_TC070_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      startDate1: "2026-08-03",
      endDate1: "2026-08-07",
      startDate2: "2026-09-07",
      endDate2: "2026-09-11",
    };
    if (mode === "static") return new VacationTc070Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc070Args>("VacationTc070Data");
      if (cached) return new VacationTc070Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Need an employee in AV=false office for auto-conversion to trigger
      const avFalseEmployee = await db.queryOne<{
        login: string;
        email: string;
      }>(
        `SELECT e.login, e.email
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE e.enabled = true
           AND o.advance_vacation = false
           AND e.manager IS NOT NULL
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND ev.available_vacation_days >= 15
         ORDER BY random()
         LIMIT 1`,
      );

      const login = avFalseEmployee.login;

      // Find two non-conflicting weeks in different months
      const week1 = await findAvailableWeekFromServer(db, login, 12, 20);
      const week2 = await findAvailableWeekFromServer(db, login, 16, 20);

      const args: Tc070Args = {
        employeeLogin: login,
        employeeEmail: avFalseEmployee.email,
        startDate1: week1.startDate,
        endDate1: week1.endDate,
        startDate2: week2.startDate,
        endDate2: week2.endDate,
      };

      if (mode === "saved") saveToDisk("VacationTc070Data", args);
      return new VacationTc070Data(args);
    } finally {
      await db.close();
    }
  }
}

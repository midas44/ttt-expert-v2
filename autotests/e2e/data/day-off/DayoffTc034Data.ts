declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findApprovedRequestWithCalendarDay,
  createApprovedRequestForCalendarTest,
  countLedgerEntries,
} from "./queries/dayoffQueries";

interface Tc034Args {
  requestId: number;
  employeeId: number;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  calendarId: number;
  officeId: number;
  ledgerCountBefore: number;
}

/**
 * TC-DO-034: Path B — Calendar day removed, status DELETED_FROM_CALENDAR.
 *
 * Finds or creates an APPROVED transfer request whose original_date matches
 * a production calendar day. The test will delete that calendar day,
 * triggering Path B cascade (CalendarDeletedApplicationEvent →
 * EmployeeDayOffCalendarUpdateServiceImpl.deleteDayOffs).
 *
 * The cascade:
 * 1. Sets request status to DELETED_FROM_CALENDAR
 * 2. Physically deletes all ledger entries for that date
 * 3. Triggers vacation balance recalculation
 */
export class DayoffTc034Data {
  readonly requestId: number;
  readonly employeeId: number;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly calendarId: number;
  readonly officeId: number;
  readonly ledgerCountBefore: number;

  constructor(args: Tc034Args) {
    this.requestId = args.requestId;
    this.employeeId = args.employeeId;
    this.employeeLogin = args.employeeLogin;
    this.employeeName = args.employeeName;
    this.originalDate = args.originalDate;
    this.personalDate = args.personalDate;
    this.calendarId = args.calendarId;
    this.officeId = args.officeId;
    this.ledgerCountBefore = args.ledgerCountBefore;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc034Data> {
    const defaults: Tc034Args = {
      requestId: 0,
      employeeId: 0,
      employeeLogin: process.env.DAYOFF_TC034_EMPLOYEE ?? "ogribanova",
      employeeName: "Грибанова Ольга",
      originalDate: "2026-05-01",
      personalDate: "2026-07-07",
      calendarId: 1,
      officeId: 1,
      ledgerCountBefore: 0,
    };
    if (mode === "static") return new DayoffTc034Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc034Args>("DayoffTc034Data");
      if (cached) return new DayoffTc034Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      let row: Omit<Tc034Args, "ledgerCountBefore">;
      try {
        row = await findApprovedRequestWithCalendarDay(db);
      } catch {
        row = await createApprovedRequestForCalendarTest(db);
      }

      const ledgerCountBefore = await countLedgerEntries(db, row.employeeId, row.originalDate);

      const args: Tc034Args = { ...row, ledgerCountBefore };
      saveToDisk("DayoffTc034Data", args);
      return new DayoffTc034Data(args);
    } finally {
      await db.close();
    }
  }
}

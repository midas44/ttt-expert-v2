declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeForPeriodTest,
  createNewRequestForDate,
  getApprovePeriod,
} from "./queries/dayoffQueries";

interface Tc035Args {
  officeId: number;
  employeeId: number;
  employeeLogin: string;
  managerId: number;
  currentApprovePeriod: string;
  currentReportPeriod: string;
  /** Holiday in the month AFTER approve period — will be affected */
  affectedDate: string;
  affectedRequestId: number;
  /** Holiday in a later month — will NOT be affected */
  unaffectedDate: string;
  unaffectedRequestId: number;
}

/**
 * TC-DO-035: Path C — System rejects NEW requests when period changes.
 *
 * Finds an office with an approve period, creates 2 NEW transfer requests
 * in different months (one in the next month after approve period, one later).
 * The test will advance both report and approve periods by 1 month via PATCH,
 * triggering PeriodChangedEventHandler → rejectedBySystem() cascade.
 *
 * Expected: the request in the newly-approved month gets REJECTED,
 * the other request remains NEW.
 */
export class DayoffTc035Data {
  readonly officeId: number;
  readonly employeeId: number;
  readonly employeeLogin: string;
  readonly managerId: number;
  readonly currentApprovePeriod: string;
  readonly currentReportPeriod: string;
  readonly affectedDate: string;
  readonly affectedRequestId: number;
  readonly unaffectedDate: string;
  readonly unaffectedRequestId: number;

  constructor(args: Tc035Args) {
    this.officeId = args.officeId;
    this.employeeId = args.employeeId;
    this.employeeLogin = args.employeeLogin;
    this.managerId = args.managerId;
    this.currentApprovePeriod = args.currentApprovePeriod;
    this.currentReportPeriod = args.currentReportPeriod;
    this.affectedDate = args.affectedDate;
    this.affectedRequestId = args.affectedRequestId;
    this.unaffectedDate = args.unaffectedDate;
    this.unaffectedRequestId = args.unaffectedRequestId;
  }

  /** The new period start_date (1 month after current) */
  get newPeriod(): string {
    const d = new Date(this.currentApprovePeriod + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc035Data> {
    const defaults: Tc035Args = {
      officeId: 2,
      employeeId: 0,
      employeeLogin: process.env.DAYOFF_TC035_EMPLOYEE ?? "ogribanova",
      managerId: 0,
      currentApprovePeriod: "2026-03-01",
      currentReportPeriod: "2026-03-01",
      affectedDate: "2026-04-13",
      affectedRequestId: 0,
      unaffectedDate: "2026-06-12",
      unaffectedRequestId: 0,
    };
    if (mode === "static") return new DayoffTc035Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc035Args>("DayoffTc035Data");
      if (cached) return new DayoffTc035Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const officeId = 2;
      const currentApprovePeriod = await getApprovePeriod(db, officeId);

      // Also get report period (approve can't exceed report)
      const reportRow = await db.queryOne<{ start_date: string }>(
        `SELECT start_date::text FROM ttt_backend.office_period
         WHERE office = $1 AND type = 'REPORT'`,
        [officeId],
      );
      const currentReportPeriod = reportRow.start_date;

      // Find employee with 2 free holidays in different months after approve period
      const emp = await findEmployeeForPeriodTest(db, officeId, currentApprovePeriod);

      // Create 2 NEW requests
      const req1 = await createNewRequestForDate(
        db, emp.employeeId, emp.managerId, emp.holiday1,
      );
      const req2 = await createNewRequestForDate(
        db, emp.employeeId, emp.managerId, emp.holiday2,
      );

      const args: Tc035Args = {
        officeId,
        employeeId: emp.employeeId,
        employeeLogin: emp.employeeLogin,
        managerId: emp.managerId,
        currentApprovePeriod,
        currentReportPeriod,
        affectedDate: emp.holiday1,
        affectedRequestId: req1.requestId,
        unaffectedDate: emp.holiday2,
        unaffectedRequestId: req2.requestId,
      };
      if (mode === "saved") saveToDisk("DayoffTc035Data", args);
      return new DayoffTc035Data(args);
    } finally {
      await db.close();
    }
  }
}

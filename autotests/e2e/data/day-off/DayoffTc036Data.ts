declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  createApprovedDayoffRequest,
  countApprovedRequestsInYear,
} from "./queries/dayoffQueries";

interface Tc036Args {
  employeeId: number;
  employeeLogin: string;
  employeeName: string;
  originalOfficeId: number;
  originalOfficeName: string;
  targetOfficeId: number;
  targetOfficeName: string;
  approvedRequestIds: number[];
  approvedCountBefore: number;
}

/**
 * TC-DO-036: Path D — Employee office change deletes year ledger.
 *
 * Creates APPROVED transfer requests, then the test changes the employee's
 * salary office. This triggers EmployeeDayOffAutoDeleteToCalendarUpdateHelper.update()
 * which sets ALL requests for the year to DELETED_FROM_CALENDAR and physically
 * deletes ledger entries.
 *
 * WARNING: PAGE_SIZE=100 hard limit — if >100 requests, some may be missed.
 */
export class DayoffTc036Data {
  readonly employeeId: number;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalOfficeId: number;
  readonly originalOfficeName: string;
  readonly targetOfficeId: number;
  readonly targetOfficeName: string;
  readonly approvedRequestIds: number[];
  readonly approvedCountBefore: number;

  constructor(args: Tc036Args) {
    this.employeeId = args.employeeId;
    this.employeeLogin = args.employeeLogin;
    this.employeeName = args.employeeName;
    this.originalOfficeId = args.originalOfficeId;
    this.originalOfficeName = args.originalOfficeName;
    this.targetOfficeId = args.targetOfficeId;
    this.targetOfficeName = args.targetOfficeName;
    this.approvedRequestIds = args.approvedRequestIds;
    this.approvedCountBefore = args.approvedCountBefore;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc036Data> {
    const defaults: Tc036Args = {
      employeeId: 0,
      employeeLogin: process.env.DAYOFF_TC036_EMPLOYEE ?? "ogribanova",
      employeeName: "Грибанова Ольг��",
      originalOfficeId: 2,
      originalOfficeName: "Сатурн",
      targetOfficeId: 4,
      targetOfficeName: "Юпитер",
      approvedRequestIds: [],
      approvedCountBefore: 0,
    };
    if (mode === "static") return new DayoffTc036Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc036Args>("DayoffTc036Data");
      if (cached) return new DayoffTc036Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Create an APPROVED request — gives us a known employee + manager
      const created = await createApprovedDayoffRequest(db);

      const empInfo = await db.queryOne<{
        employeeId: number;
        officeId: number;
        officeName: string;
      }>(
        `SELECT e.id AS "employeeId", e.office_id AS "officeId", o.name AS "officeName"
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         WHERE e.login = $1`,
        [created.employeeLogin],
      );

      // Find a different office to move the employee to
      const target = await db.queryOne<{
        officeId: number;
        officeName: string;
      }>(
        `SELECT id AS "officeId", name AS "officeName"
         FROM ttt_vacation.office
         WHERE id != $1 AND active = true
         ORDER BY random()
         LIMIT 1`,
        [empInfo.officeId],
      );

      const year = new Date().getFullYear();
      const approvedCount = await countApprovedRequestsInYear(
        db, empInfo.employeeId, year,
      );

      const args: Tc036Args = {
        employeeId: empInfo.employeeId,
        employeeLogin: created.employeeLogin,
        employeeName: created.employeeName,
        originalOfficeId: empInfo.officeId,
        originalOfficeName: empInfo.officeName,
        targetOfficeId: target.officeId,
        targetOfficeName: target.officeName,
        approvedRequestIds: [created.requestId],
        approvedCountBefore: approvedCount,
      };
      if (mode === "saved") saveToDisk("DayoffTc036Data", args);
      return new DayoffTc036Data(args);
    } finally {
      await db.close();
    }
  }
}

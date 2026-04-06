declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { createNewRequestForDate } from "./queries/dayoffQueries";

interface Tc037Args {
  emp1Login: string;
  emp1Id: number;
  emp1ManagerId: number;
  emp1OfficeId: number;
  emp1OfficeName: string;
  emp1CalendarId: number;
  emp1CalDayId: number;
  emp1RequestId: number;
  emp2Login: string;
  emp2Id: number;
  emp2ManagerId: number;
  emp2OfficeId: number;
  emp2OfficeName: string;
  emp2CalendarId: number;
  emp2CalDayId: number;
  emp2RequestId: number;
  sharedDate: string;
}

/**
 * TC-DO-037: Cross-office isolation — calendar deletion in one office
 * should NOT affect another office's requests on the same date.
 *
 * Finds two employees in different offices that share a same-date future
 * public holiday (from different calendars). Creates NEW transfer requests
 * for both. The test deletes the holiday from office 1's calendar only
 * and verifies office 2's request remains unchanged.
 */
export class DayoffTc037Data {
  readonly emp1Login: string;
  readonly emp1Id: number;
  readonly emp1ManagerId: number;
  readonly emp1OfficeId: number;
  readonly emp1OfficeName: string;
  readonly emp1CalendarId: number;
  readonly emp1CalDayId: number;
  readonly emp1RequestId: number;
  readonly emp2Login: string;
  readonly emp2Id: number;
  readonly emp2ManagerId: number;
  readonly emp2OfficeId: number;
  readonly emp2OfficeName: string;
  readonly emp2CalendarId: number;
  readonly emp2CalDayId: number;
  readonly emp2RequestId: number;
  readonly sharedDate: string;

  constructor(args: Tc037Args) {
    Object.assign(this, args);
    this.emp1Login = args.emp1Login;
    this.emp1Id = args.emp1Id;
    this.emp1ManagerId = args.emp1ManagerId;
    this.emp1OfficeId = args.emp1OfficeId;
    this.emp1OfficeName = args.emp1OfficeName;
    this.emp1CalendarId = args.emp1CalendarId;
    this.emp1CalDayId = args.emp1CalDayId;
    this.emp1RequestId = args.emp1RequestId;
    this.emp2Login = args.emp2Login;
    this.emp2Id = args.emp2Id;
    this.emp2ManagerId = args.emp2ManagerId;
    this.emp2OfficeId = args.emp2OfficeId;
    this.emp2OfficeName = args.emp2OfficeName;
    this.emp2CalendarId = args.emp2CalendarId;
    this.emp2CalDayId = args.emp2CalDayId;
    this.emp2RequestId = args.emp2RequestId;
    this.sharedDate = args.sharedDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc037Data> {
    const defaults: Tc037Args = {
      emp1Login: "mpotter", emp1Id: 85, emp1ManagerId: 0,
      emp1OfficeId: 20, emp1OfficeName: "Персей",
      emp1CalendarId: 2, emp1CalDayId: 501, emp1RequestId: 0,
      emp2Login: "fagafonov", emp2Id: 990345, emp2ManagerId: 0,
      emp2OfficeId: 17, emp2OfficeName: "Сириус (Париж)",
      emp2CalendarId: 7, emp2CalDayId: 491, emp2RequestId: 0,
      sharedDate: "2026-04-06",
    };
    if (mode === "static") return new DayoffTc037Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc037Args>("DayoffTc037Data");
      if (cached) return new DayoffTc037Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find 2 employees in different offices sharing a same-date future holiday
      const pair = await db.queryOne<{
        emp1Login: string; emp1Id: number; emp1MgrId: number;
        office1Id: number; office1Name: string; cal1Id: number; calDay1Id: number;
        emp2Login: string; emp2Id: number; emp2MgrId: number;
        office2Id: number; office2Name: string; cal2Id: number; calDay2Id: number;
        sharedDate: string;
      }>(
        `SELECT
           e1.login AS "emp1Login", e1.id AS "emp1Id", e1.manager AS "emp1MgrId",
           o1.id AS "office1Id", o1.name AS "office1Name",
           oc1.calendar_id AS "cal1Id", cd1.id AS "calDay1Id",
           e2.login AS "emp2Login", e2.id AS "emp2Id", e2.manager AS "emp2MgrId",
           o2.id AS "office2Id", o2.name AS "office2Name",
           oc2.calendar_id AS "cal2Id", cd2.id AS "calDay2Id",
           cd1.calendar_date::text AS "sharedDate"
         FROM ttt_vacation.employee e1
         JOIN ttt_vacation.office o1 ON e1.office_id = o1.id
         JOIN ttt_calendar.office_calendar oc1 ON oc1.office_id = o1.id
         JOIN ttt_calendar.calendar_days cd1 ON cd1.calendar_id = oc1.calendar_id
         JOIN ttt_vacation.employee e2 ON e1.office_id != e2.office_id
         JOIN ttt_vacation.office o2 ON e2.office_id = o2.id
         JOIN ttt_calendar.office_calendar oc2 ON oc2.office_id = o2.id
         JOIN ttt_calendar.calendar_days cd2 ON cd2.calendar_id = oc2.calendar_id
         WHERE e1.enabled = true AND e2.enabled = true
           AND e1.manager IS NOT NULL AND e2.manager IS NOT NULL
           AND cd1.duration = 0 AND cd2.duration = 0
           AND cd1.calendar_date = cd2.calendar_date
           AND cd1.calendar_date > CURRENT_DATE + INTERVAL '1 day'
           AND oc1.calendar_id != oc2.calendar_id
           AND oc1.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
           AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
           AND NOT EXISTS (
             SELECT 1 FROM ttt_calendar.office_calendar x
             WHERE x.office_id = oc1.office_id AND x.since_year > oc1.since_year
               AND x.since_year <= EXTRACT(YEAR FROM CURRENT_DATE))
           AND NOT EXISTS (
             SELECT 1 FROM ttt_calendar.office_calendar x
             WHERE x.office_id = oc2.office_id AND x.since_year > oc2.since_year
               AND x.since_year <= EXTRACT(YEAR FROM CURRENT_DATE))
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.employee_dayoff_request r
             WHERE r.employee = e1.id AND r.original_date = cd1.calendar_date
               AND r.status NOT IN ('DELETED','DELETED_FROM_CALENDAR','CANCELED'))
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.employee_dayoff_request r
             WHERE r.employee = e2.id AND r.original_date = cd2.calendar_date
               AND r.status NOT IN ('DELETED','DELETED_FROM_CALENDAR','CANCELED'))
         ORDER BY cd1.calendar_date
         LIMIT 1`,
      );

      // Create NEW transfer requests for both employees on the shared date
      const req1 = await createNewRequestForDate(
        db, pair.emp1Id, pair.emp1MgrId, pair.sharedDate,
      );
      const req2 = await createNewRequestForDate(
        db, pair.emp2Id, pair.emp2MgrId, pair.sharedDate,
      );

      const args: Tc037Args = {
        emp1Login: pair.emp1Login, emp1Id: pair.emp1Id,
        emp1ManagerId: pair.emp1MgrId,
        emp1OfficeId: pair.office1Id, emp1OfficeName: pair.office1Name,
        emp1CalendarId: pair.cal1Id, emp1CalDayId: pair.calDay1Id,
        emp1RequestId: req1.requestId,
        emp2Login: pair.emp2Login, emp2Id: pair.emp2Id,
        emp2ManagerId: pair.emp2MgrId,
        emp2OfficeId: pair.office2Id, emp2OfficeName: pair.office2Name,
        emp2CalendarId: pair.cal2Id, emp2CalDayId: pair.calDay2Id,
        emp2RequestId: req2.requestId,
        sharedDate: pair.sharedDate,
      };
      saveToDisk("DayoffTc037Data", args);
      return new DayoffTc037Data(args);
    } finally {
      await db.close();
    }
  }
}

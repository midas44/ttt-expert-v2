declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findFreeHolidayForTransfer,
  findFutureWorkingDay,
} from "./queries/dayoffQueries";

interface Tc005Args {
  username: string;
  originalDate: string;
  personalDate: string;
  requestId: number | null;
  needsApiSetup: boolean;
}

/**
 * TC-DO-005: Cancel pending transfer request (NEW status).
 *
 * Tries to find an existing NEW transfer request for an employee.
 * If none exists, finds a free holiday + working day so the spec
 * can create one via API before cancelling it.
 */
export class DayoffTc005Data {
  readonly username: string;
  /** ISO date of the original public holiday. */
  readonly originalDate: string;
  /** ISO date of the personal (target) day. */
  readonly personalDate: string;
  /** Request ID if an existing NEW request was found (null = needs API setup). */
  readonly requestId: number | null;
  /** Whether the test must create a transfer request via API first. */
  readonly needsApiSetup: boolean;

  constructor(
    username = process.env.DAYOFF_TC005_USER ?? "trikhter",
    originalDate = process.env.DAYOFF_TC005_ORIG ?? "2026-06-01",
    personalDate = process.env.DAYOFF_TC005_PERS ?? "2026-06-15",
    requestId: number | null = null,
    needsApiSetup = true,
  ) {
    this.username = username;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.requestId = requestId;
    this.needsApiSetup = needsApiSetup;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc005Data> {
    if (mode === "static") return new DayoffTc005Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc005Args>("DayoffTc005Data");
      if (cached)
        return new DayoffTc005Data(
          cached.username,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
          cached.needsApiSetup,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      // Try to find an existing NEW transfer request
      const existing = await db.queryOneOrNull<{
        login: string;
        request_id: number;
        personal_date: string;
        original_date: string;
      }>(
        `SELECT e.login,
                edr.id AS request_id,
                edr.personal_date::text,
                edr.original_date::text
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_dayoff_request edr ON edr.employee = e.id
         WHERE edr.status = 'NEW'
           AND e.enabled = true
           AND edr.original_date > CURRENT_DATE
         ORDER BY random()
         LIMIT 1`,
      );

      if (existing) {
        const instance = new DayoffTc005Data(
          existing.login,
          existing.original_date,
          existing.personal_date,
          existing.request_id,
          false,
        );
          saveToDisk("DayoffTc005Data", {
            username: existing.login,
            originalDate: existing.original_date,
            personalDate: existing.personal_date,
            requestId: existing.request_id,
            needsApiSetup: false,
          });
        return instance;
      }

      // No existing NEW request — find a free holiday to create one
      const row = await findFreeHolidayForTransfer(db);
      const targetDate = await findFutureWorkingDay(
        db,
        row.login,
        row.public_date,
      );

      const instance = new DayoffTc005Data(
        row.login,
        row.public_date,
        targetDate,
        null,
        true,
      );

        saveToDisk("DayoffTc005Data", {
          username: row.login,
          originalDate: row.public_date,
          personalDate: targetDate,
          requestId: null,
          needsApiSetup: true,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Display format DD.MM.YYYY for matching table rows. */
  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }
}

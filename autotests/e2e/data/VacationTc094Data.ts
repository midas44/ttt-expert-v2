declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface AvFalseEmployeeRow {
  login: string;
  net_available: string;
}

/**
 * TC-VAC-094: Insufficient days for REGULAR vacation (AV=false).
 * Finds an AV=false employee whose NET available days (balance minus
 * reserved by NEW/APPROVED vacations) is less than 5, then attempts
 * a 5-day vacation. Should fail with validation error.
 */
export class VacationTc094Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — a future Monday
  readonly endDate: string;   // dd.mm.yyyy — the following Friday (5 working days)
  readonly netAvailableDays: number; // net balance for assertion context

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc094Data> {
    if (mode === "static") return new VacationTc094Data();

    const db = new DbClient(tttConfig);
    try {
      // Find AV=false employee whose NET available days < 5
      // Net = available_vacation_days - SUM(regular_days of NEW/APPROVED vacations)
      const row = await db.queryOne<AvFalseEmployeeRow>(
        `SELECT e.login,
                (COALESCE(SUM(ev.available_vacation_days), 0)
                 - COALESCE(
                   (SELECT SUM(v.regular_days)
                    FROM ttt_vacation.vacation v
                    WHERE v.employee = e.id
                      AND v.status IN ('NEW', 'APPROVED')), 0)
                )::text AS net_available
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE o.advance_vacation = false
           AND e.enabled = true
           AND e.manager IS NOT NULL
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
         GROUP BY e.login, e.id
         HAVING (COALESCE(SUM(ev.available_vacation_days), 0)
                 - COALESCE(
                   (SELECT SUM(v.regular_days)
                    FROM ttt_vacation.vacation v
                    WHERE v.employee = e.id
                      AND v.status IN ('NEW', 'APPROVED')), 0)
                ) < 5
         ORDER BY random()
         LIMIT 1`,
      );

      const range = await VacationTc094Data.findAvailableRange(db, row.login);
      return new VacationTc094Data(
        row.login,
        range.start,
        range.end,
        Number(row.net_available),
      );
    } finally {
      await db.close();
    }
  }

  private static async findAvailableRange(
    db: DbClient,
    login: string,
  ): Promise<{ start: string; end: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);

    for (let attempt = 0; attempt < 16; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4); // Mon-Fri = 5 working days

      const startIso = VacationTc094Data.toIso(start);
      const endIso = VacationTc094Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          start: VacationTc094Data.toDdMmYyyy(start),
          end: VacationTc094Data.toDdMmYyyy(end),
        };
      }
    }
    throw new Error(
      `No conflict-free Mon-Fri window for "${login}" within 16 weeks`,
    );
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC094_USERNAME ?? "pvaynmaster",
    startDate = "07.04.2026",
    endDate = "10.04.2026",
    netAvailableDays = 2,
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
    this.netAvailableDays = netAvailableDays;
  }
}

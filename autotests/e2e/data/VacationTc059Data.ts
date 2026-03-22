declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * TC-VAC-059: Verify working days exclude holidays.
 * Finds an employee from a Russian office and uses a known holiday week
 * (May 1, 2026 — Labour Day, a Friday) to verify day count = 4 instead of 5.
 *
 * The calendar_days schema is separate and not directly linkable via DbClient,
 * so we use known Russian holidays and find employees in Russian offices.
 */
export class VacationTc059Data {
  readonly employeeLogin: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly expectedDays: number;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc059Data> {
    if (mode === "static") return new VacationTc059Data();

    const db = new DbClient(tttConfig);
    try {
      // Find employee in a Russian office with enough days for vacation creation
      // Russian offices: names containing "Марс", "Сириус", "Кассиопея", "НСК", "Андромеда", etc.
      const emp = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_backend.employee be ON be.login = e.login
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE e.enabled = true
           AND e.manager IS NOT NULL
           AND (be.is_contractor IS NULL OR be.is_contractor = false)
           AND r.role_name = 'ROLE_EMPLOYEE'
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND ev.available_vacation_days >= 5
           AND o.name_latin IN ('Mars (Nsk)', 'Sirius (Msk)', 'Andromeda', 'Kassiopeia (udalenshchiki Noveo-NSK)')
         ORDER BY random()
         LIMIT 1`,
      );

      // Known Russian holiday: May 1, 2026 (Friday) — Labour Day
      // Week: Mon Apr 27 - Fri May 1 → 4 working days
      const startDate = "27.04.2026";
      const endDate = "01.05.2026";

      // Verify no conflict
      const conflict = await hasVacationConflict(db, emp.login, "2026-04-27", "2026-05-01");
      if (conflict) {
        // Try the Victory Day week instead: May 11 (Mon holiday) — May 15 (Fri)
        const conflict2 = await hasVacationConflict(db, emp.login, "2026-05-11", "2026-05-15");
        if (!conflict2) {
          return new VacationTc059Data(emp.login, "11.05.2026", "15.05.2026", 4);
        }
        // Jun 12 (Fri) — Russia Day week
        return new VacationTc059Data(emp.login, "08.06.2026", "12.06.2026", 4);
      }

      return new VacationTc059Data(emp.login, startDate, endDate, 4);
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC059_EMPLOYEE ?? "dmoskvina",
    startDate = "27.04.2026",
    endDate = "01.05.2026",
    expectedDays = 4,
  ) {
    this.employeeLogin = employeeLogin;
    this.startDate = startDate;
    this.endDate = endDate;
    this.expectedDays = expectedDays;
  }
}

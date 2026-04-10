declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc018Args {
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-018: Re-approve REJECTED vacation (without edit).
 * Requires two logins: subordinate creates vacation, manager rejects then re-approves.
 * Data class finds a subordinate of pvaynmaster with sufficient vacation days.
 */
export class VacationTc018Data {
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly managerLogin: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc018Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeName = args.employeeName;
    this.managerLogin = args.managerLogin;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc018Data> {
    if (mode === "static") {
      return new VacationTc018Data({
        employeeLogin: process.env.VAC_TC018_EMPLOYEE ?? "nzavalny",
        employeeName: "Nikolaj Zavalny",
        managerLogin: "pvaynmaster",
        startDateIso: "2026-06-29",
        endDateIso: "2026-07-03",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc018Args>("VacationTc018Data");
      if (cached) return new VacationTc018Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await db.queryOne<{
        employee_login: string;
        employee_name: string;
        manager_login: string;
      }>(
        `SELECT e.login AS employee_login,
                COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS employee_name,
                m.login AS manager_login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         JOIN ttt_vacation.employee m ON e.manager = m.id
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE m.login = 'pvaynmaster'
           AND e.enabled = true
           AND e.login != 'pvaynmaster'
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND ev.available_vacation_days >= 10
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.vacation v
             WHERE v.employee = e.id
               AND v.status IN ('NEW', 'APPROVED')
               AND v.start_date > CURRENT_DATE
           )
         ORDER BY random()
         LIMIT 1`,
      );

      const { startDate, endDate } = await findAvailableWeek(
        db,
        emp.employee_login,
        14,
      );

      const args: Tc018Args = {
        employeeLogin: emp.employee_login,
        employeeName: emp.employee_name,
        managerLogin: emp.manager_login,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      saveToDisk("VacationTc018Data", args);
      return new VacationTc018Data(args);
    } finally {
      await db.close();
    }
  }
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

async function findAvailableWeek(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 20,
): Promise<{ startDate: string; endDate: string }> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);

    const startIso = toIso(start);
    const endIso = toIso(end);

    if (!(await hasVacationConflict(db, login, startIso, endIso))) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(
    `No conflict-free week found for ${login} within ${maxAttempts} weeks`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

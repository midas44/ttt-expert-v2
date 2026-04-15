declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeWithManager,
  hasVacationConflict,
} from "./queries/vacationQueries";

interface Tc001Args {
  username: string;
  managerLogin: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-001: Create REGULAR vacation — happy path.
 * Needs an employee with >=5 available vacation days, a manager, and
 * a conflict-free Mon–Fri week for the vacation dates.
 */
export class VacationTc001Data {
  readonly username: string;
  readonly managerLogin: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC001_USER ?? "pvaynmaster",
    managerLogin = "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = username;
    this.managerLogin = managerLogin;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(endDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc001Data> {
    if (mode === "static") return new VacationTc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("VacationTc001Data");
      if (cached) {
        return new VacationTc001Data(
          cached.username,
          cached.managerLogin,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithManager(db, 5);
      const { startDate, endDate } = await findAvailableWeek(
        db,
        emp.employee_login,
        2,
      );

      const args: Tc001Args = {
        username: emp.employee_login,
        managerLogin: emp.manager_login,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      saveToDisk("VacationTc001Data", args);
      return new VacationTc001Data(
        args.username,
        args.managerLogin,
        args.startDateIso,
        args.endDateIso,
      );
    } finally {
      await db.close();
    }
  }
}

/** Converts "yyyy-mm-dd" to "dd.mm.yyyy" for the calendar widget. */
function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Builds a regex matching the EN period column text, e.g. "13 – 17 Apr 2026". */
function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

/** Finds a conflict-free Mon–Fri week starting weeksAhead from now. */
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

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithManager,
  hasSickLeaveConflict,
  hasVacationConflict,
} from "./queries/sickLeaveQueries";

interface Tc001Args {
  username: string;
  managerLogin: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-SL-001: Create sick leave — happy path.
 * Needs an enabled employee with a manager, and a conflict-free date range.
 */
export class SickLeaveTc001Data {
  readonly username: string;
  readonly managerLogin: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly expectedCalendarDays: number;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.SL_TC001_USER ?? "pvaynmaster",
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
    this.expectedCalendarDays = calcCalendarDays(startDateIso, endDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<SickLeaveTc001Data> {
    if (mode === "static") return new SickLeaveTc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("SickLeaveTc001Data");
      if (cached) {
        return new SickLeaveTc001Data(
          cached.username,
          cached.managerLogin,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithManager(db);
      const { startDate, endDate } = await findConflictFreeRange(
        db,
        emp.employee_login,
        6,
      );

      const args: Tc001Args = {
        username: emp.employee_login,
        managerLogin: emp.manager_login,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      if (mode === "saved") saveToDisk("SickLeaveTc001Data", args);
      return new SickLeaveTc001Data(
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

/** Calculates calendar days between two ISO dates (inclusive). */
function calcCalendarDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const s = new Date(startIso);
  const e = new Date(endIso);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

/**
 * Builds a regex matching the sick leave table date format.
 * Table shows: "25 – 30 Apr 2026" (same month) or "25 Apr – 02 May 2026" (cross-month).
 */
function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  // Match: "25 – 30 Apr 2026" or "25 Apr – 2 May 2026"
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

/**
 * Finds a conflict-free date range for a sick leave.
 * Starts from today + daysAhead and looks for a 6-day range with no
 * sick leave or vacation conflicts.
 */
async function findConflictFreeRange(
  db: DbClient,
  login: string,
  daysAhead: number,
  duration = 5,
  maxAttempts = 30,
): Promise<{ startDate: string; endDate: string }> {
  const now = new Date();

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(now);
    start.setDate(now.getDate() + daysAhead + i * 3);
    const end = new Date(start);
    end.setDate(start.getDate() + duration);

    const startIso = toIso(start);
    const endIso = toIso(end);

    const [slConflict, vacConflict] = await Promise.all([
      hasSickLeaveConflict(db, login, startIso, endIso),
      hasVacationConflict(db, login, startIso, endIso),
    ]);

    if (!slConflict && !vacConflict) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(
    `No conflict-free range found for ${login} within ${maxAttempts} attempts`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

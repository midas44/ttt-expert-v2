declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithManager,
  hasVacationConflict,
} from "./queries/vacationQueries";

interface Tc003Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-003: Create vacation with comment.
 * Needs an employee with >=3 available vacation days, a manager, and
 * a conflict-free Mon–Wed window for a 3-day vacation.
 */
export class VacationTc003Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;
  readonly comment = "Family trip";

  constructor(
    username = process.env.VAC_TC003_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(endDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc003Data> {
    if (mode === "static") return new VacationTc003Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc003Args>("VacationTc003Data");
      if (cached) {
        return new VacationTc003Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithManager(db, 3);
      const { startDate, endDate } = await findAvailableThreeDays(
        db,
        emp.employee_login,
        3,
      );

      const args: Tc003Args = {
        username: emp.employee_login,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      if (mode === "saved") saveToDisk("VacationTc003Data", args);
      return new VacationTc003Data(
        args.username,
        args.startDateIso,
        args.endDateIso,
      );
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

/** Builds a regex matching the EN period column text, e.g. "13 – 15 Apr 2026". */
function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

/** Finds a conflict-free Mon–Wed (3 working days) starting weeksAhead from now. */
async function findAvailableThreeDays(
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
    end.setDate(start.getDate() + 2); // Wednesday

    const startIso = toIso(start);
    const endIso = toIso(end);

    if (!(await hasVacationConflict(db, login, startIso, endIso))) {
      return { startDate: startIso, endDate: endIso };
    }
  }
  throw new Error(
    `No conflict-free 3-day window found for ${login} within ${maxAttempts} weeks`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

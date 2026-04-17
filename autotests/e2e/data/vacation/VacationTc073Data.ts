declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc073Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  startInput: string;
  endInput: string;
  periodPattern: string;
  availableDaysBefore: number;
  vacationDays: number;
}

/**
 * TC-VAC-073: Regression — Edit own vacation shows 0 available (#3014-21).
 * SETUP: API creates a large vacation consuming most of the employee's balance.
 * Test: Opens edit dialog, verifies available days shown EXCLUDES the current
 * vacation's days (i.e., not 0). Bug #3014-21 (fixed) showed 0 available.
 */
export class VacationTc073Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;
  readonly availableDaysBefore: number;
  readonly vacationDays: number;

  constructor(args: Tc073Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startInput = args.startInput;
    this.endInput = args.endInput;
    this.periodPattern = new RegExp(args.periodPattern);
    this.availableDaysBefore = args.availableDaysBefore;
    this.vacationDays = args.vacationDays;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc073Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc073Data({
        username,
        startDateIso: "",
        endDateIso: "",
        startInput: "",
        endInput: "",
        periodPattern: ".",
        availableDaysBefore: 20,
        vacationDays: 5,
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc073Args>("VacationTc073Data");
      if (cached) return new VacationTc073Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Get pvaynmaster's available days for current year
      const balRow = await db.queryOne<{ available_days: string }>(
        `SELECT ev.available_vacation_days::text AS available_days
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE e.login = $1
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [username],
      );
      const availableDays = parseInt(balRow.available_days, 10);

      // Find a conflict-free Mon-Fri week
      const { startDate, endDate } = await findAvailableWeek(db, username, 6);

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
      const sd = parseInt(startDate.split("-")[2], 10);
      const ed = parseInt(endDate.split("-")[2], 10);
      const em = MONTHS[parseInt(endDate.split("-")[1], 10)];
      const pattern = `${sd}.*${ed}.*${em}`;

      const args: Tc073Args = {
        username,
        startDateIso: startDate,
        endDateIso: endDate,
        startInput: toCalendarFormat(startDate),
        endInput: toCalendarFormat(endDate),
        periodPattern: pattern,
        availableDaysBefore: availableDays,
        vacationDays: 5,
      };

      saveToDisk("VacationTc073Data", args);
      return new VacationTc073Data(args);
    } finally {
      await db.close();
    }
  }
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

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

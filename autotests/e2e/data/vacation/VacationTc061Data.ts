declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc061Args {
  username: string;
  yearlyBreakdownBefore: { year: number; days: number }[];
  totalAvailableDays: number;
  startDateIso: string;
  endDateIso: string;
}

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

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * TC-VAC-061: FIFO redistribution on cancel — days returned.
 * Uses pvaynmaster (API token owner who can self-approve) to create,
 * approve, then cancel a vacation, verifying days return correctly.
 */
export class VacationTc061Data {
  readonly username: string;
  readonly yearlyBreakdownBefore: { year: number; days: number }[];
  readonly totalAvailableDays: number;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(args: Tc061Args) {
    this.username = args.username;
    this.yearlyBreakdownBefore = args.yearlyBreakdownBefore;
    this.totalAvailableDays = args.totalAvailableDays;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc061Data> {
    const defaults: Tc061Args = {
      username: process.env.VAC_TC061_USER ?? "pvaynmaster",
      yearlyBreakdownBefore: [
        { year: new Date().getFullYear() - 1, days: 5 },
        { year: new Date().getFullYear(), days: 20 },
      ],
      totalAvailableDays: 25,
      startDateIso: "",
      endDateIso: "",
    };
    if (mode === "static") return new VacationTc061Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc061Args>("VacationTc061Data");
      if (cached) return new VacationTc061Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Use pvaynmaster (API token owner who can self-approve via API).
      // Verify they have multi-year balance.
      const login = "pvaynmaster";

      const yearRows = await db.query<{ year: string; days: string }>(
        `SELECT ev.year::text, ev.available_vacation_days::text AS days
         FROM ttt_vacation.employee_vacation ev
         JOIN ttt_vacation.employee ve ON ev.employee = ve.id
         WHERE ve.login = $1
           AND ev.available_vacation_days > 0
         ORDER BY ev.year ASC`,
        [login],
      );

      const yearlyBreakdownBefore = yearRows.map((r) => ({
        year: parseInt(r.year, 10),
        days: Math.round(parseFloat(r.days)),
      }));
      const totalAvailableDays = yearlyBreakdownBefore.reduce(
        (sum, e) => sum + e.days,
        0,
      );

      // Find a conflict-free week (4+ weeks ahead for payment date validity)
      const week = await findAvailableWeek(db, login, 4);

      const args: Tc061Args = {
        username: login,
        yearlyBreakdownBefore,
        totalAvailableDays,
        startDateIso: week.startDate,
        endDateIso: week.endDate,
      };

      if (mode === "saved") saveToDisk("VacationTc061Data", args);
      return new VacationTc061Data(args);
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

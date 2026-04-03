declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc062Args {
  username: string;
  yearlyBreakdown: { year: number; days: number }[];
  totalAvailableDays: number;
  yearCount: number;
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
 * TC-VAC-062: AV=true multi-year balance distribution (#3361).
 * Finds an AV=true employee with balance across 3+ years.
 * Bug #3361 (OPEN): multi-year distribution may block creation
 * even when overall balance is sufficient.
 */
export class VacationTc062Data {
  readonly username: string;
  readonly yearlyBreakdown: { year: number; days: number }[];
  readonly totalAvailableDays: number;
  readonly yearCount: number;
  readonly startInput: string;
  readonly endInput: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc062Args) {
    this.username = args.username;
    this.yearlyBreakdown = args.yearlyBreakdown;
    this.totalAvailableDays = args.totalAvailableDays;
    this.yearCount = args.yearCount;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc062Data> {
    const defaults: Tc062Args = {
      username: process.env.VAC_TC062_USER ?? "pvaynmaster",
      yearlyBreakdown: [
        { year: new Date().getFullYear() - 2, days: 3 },
        { year: new Date().getFullYear() - 1, days: 5 },
        { year: new Date().getFullYear(), days: 20 },
      ],
      totalAvailableDays: 28,
      yearCount: 3,
      startDateIso: "",
      endDateIso: "",
    };
    if (mode === "static") return new VacationTc062Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc062Args>("VacationTc062Data");
      if (cached) return new VacationTc062Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find AV=true employee with balance across 3+ years
      const row = await db.queryOne<{ login: string }>(
        `SELECT ve.login
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office o ON ve.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON ve.id = ev.employee
         WHERE o.advance_vacation = true
           AND ve.enabled = true
           AND ve.manager IS NOT NULL
           AND ev.available_vacation_days > 0
         GROUP BY ve.login
         HAVING COUNT(DISTINCT ev.year) >= 3
           AND SUM(ev.available_vacation_days) >= 5
         ORDER BY random()
         LIMIT 1`,
      );

      // Fetch per-year breakdown
      const yearRows = await db.query<{ year: string; days: string }>(
        `SELECT ev.year::text, ev.available_vacation_days::text AS days
         FROM ttt_vacation.employee_vacation ev
         JOIN ttt_vacation.employee ve ON ev.employee = ve.id
         WHERE ve.login = $1
           AND ev.available_vacation_days > 0
         ORDER BY ev.year ASC`,
        [row.login],
      );

      const yearlyBreakdown = yearRows.map((r) => ({
        year: parseInt(r.year, 10),
        days: Math.round(parseFloat(r.days)),
      }));
      const totalAvailableDays = yearlyBreakdown.reduce(
        (sum, e) => sum + e.days,
        0,
      );

      // Find a conflict-free week
      const week = await findAvailableWeek(db, row.login, 4);

      const args: Tc062Args = {
        username: row.login,
        yearlyBreakdown,
        totalAvailableDays,
        yearCount: yearlyBreakdown.length,
        startDateIso: week.startDate,
        endDateIso: week.endDate,
      };

      if (mode === "saved") saveToDisk("VacationTc062Data", args);
      return new VacationTc062Data(args);
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

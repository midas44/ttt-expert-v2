declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc006Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  newStartDateIso: string;
}

/**
 * TC-VAC-006: Edit APPROVED vacation → resets status to NEW.
 * SETUP: API creates and approves a Mon–Fri vacation for pvaynmaster.
 * Test: edits the start date to Tuesday (one day later), verifying
 * the warning message and that status resets from APPROVED to NEW.
 */
export class VacationTc006Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly newStartDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly newStartInput: string;
  readonly periodPattern: RegExp;
  readonly newPeriodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC006_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
    newStartDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.newStartDateIso = newStartDateIso;
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(endDateIso);
    this.newStartInput = toCalendarFormat(newStartDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
    this.newPeriodPattern = toPeriodPattern(newStartDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc006Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc006Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc006Args>("VacationTc006Data");
      if (cached) {
        return new VacationTc006Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
          cached.newStartDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(
        db,
        username,
        7,
      );
      // Tuesday = start + 1 day
      const tue = new Date(startDate);
      tue.setDate(tue.getDate() + 1);
      const newStartDate = toIso(tue);

      const args: Tc006Args = {
        username,
        startDateIso: startDate,
        endDateIso: endDate,
        newStartDateIso: newStartDate,
      };

      if (mode === "saved") saveToDisk("VacationTc006Data", args);
      return new VacationTc006Data(
        args.username,
        args.startDateIso,
        args.endDateIso,
        args.newStartDateIso,
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

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

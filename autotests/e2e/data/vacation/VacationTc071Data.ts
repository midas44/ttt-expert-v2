declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc071Args {
  username: string;
  existingStartIso: string;
  existingEndIso: string;
  overlapStartInput: string;
  overlapEndInput: string;
}

/**
 * TC-VAC-071: Regression — Overlapping vacations not blocked by frontend (#3240).
 * SETUP: API creates a vacation for pvaynmaster (Mon-Fri of week N).
 * Test: Attempts to create a second vacation overlapping with the first.
 * Verifies frontend shows overlap error before submission.
 * 3-way overlap check: start-in-range, end-in-range, enclosing.
 */
export class VacationTc071Data {
  readonly username: string;
  readonly existingStartIso: string;
  readonly existingEndIso: string;
  readonly existingPeriodPattern: RegExp;
  /** Overlap attempt: starts Wed of same week (mid-overlap) through next Tuesday */
  readonly overlapStartInput: string;
  readonly overlapEndInput: string;

  constructor(
    username = process.env.VAC_TC071_USER ?? "pvaynmaster",
    existingStartIso = "",
    existingEndIso = "",
    overlapStartInput = "",
    overlapEndInput = "",
  ) {
    this.username = username;
    this.existingStartIso = existingStartIso;
    this.existingEndIso = existingEndIso;
    this.existingPeriodPattern = toPeriodPattern(existingStartIso, existingEndIso);
    this.overlapStartInput = overlapStartInput;
    this.overlapEndInput = overlapEndInput;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc071Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc071Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc071Args>("VacationTc071Data");
      if (cached) {
        return new VacationTc071Data(
          cached.username,
          cached.existingStartIso,
          cached.existingEndIso,
          cached.overlapStartInput,
          cached.overlapEndInput,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(db, username, 11);
      // Overlap: Wed of the same week (start+2) through next Tuesday (end+5)
      const wed = new Date(startDate);
      wed.setDate(wed.getDate() + 2);
      const nextTue = new Date(endDate);
      nextTue.setDate(nextTue.getDate() + 5);

      const args: Tc071Args = {
        username,
        existingStartIso: startDate,
        existingEndIso: endDate,
        overlapStartInput: toCalendarFormat(toIso(wed)),
        overlapEndInput: toCalendarFormat(toIso(nextTue)),
      };

      if (mode === "saved") saveToDisk("VacationTc071Data", args);
      return new VacationTc071Data(
        args.username,
        args.existingStartIso,
        args.existingEndIso,
        args.overlapStartInput,
        args.overlapEndInput,
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
  throw new Error(`No conflict-free week found for ${login} within ${maxAttempts} weeks`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

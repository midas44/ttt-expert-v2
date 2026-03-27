declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc005Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  newEndDateIso: string;
}

/**
 * TC-VAC-005: Edit vacation dates (NEW status).
 * SETUP: API creates a Mon–Fri vacation for pvaynmaster.
 * Test: edits the end date to extend by 5 more days (second Friday).
 * Needs pvaynmaster with >=10 available vacation days and two conflict-free weeks.
 */
export class VacationTc005Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly newEndDateIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly newEndInput: string;
  readonly periodPattern: RegExp;
  readonly newPeriodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC005_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
    newEndDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.newEndDateIso = newEndDateIso;
    this.startInput = toCalendarFormat(startDateIso);
    this.endInput = toCalendarFormat(endDateIso);
    this.newEndInput = toCalendarFormat(newEndDateIso);
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
    this.newPeriodPattern = toPeriodPattern(startDateIso, newEndDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc005Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc005Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc005Args>("VacationTc005Data");
      if (cached) {
        return new VacationTc005Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
          cached.newEndDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // Find two consecutive conflict-free weeks for pvaynmaster
      const { startDate, endDate, newEndDate } = await findTwoAvailableWeeks(
        db,
        username,
        5,
      );

      const args: Tc005Args = {
        username,
        startDateIso: startDate,
        endDateIso: endDate,
        newEndDateIso: newEndDate,
      };

      if (mode === "saved") saveToDisk("VacationTc005Data", args);
      return new VacationTc005Data(
        args.username,
        args.startDateIso,
        args.endDateIso,
        args.newEndDateIso,
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

/** Builds a regex matching the EN period column text, e.g. "13 – 17 Apr 2026". */
function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

/**
 * Finds two consecutive conflict-free weeks (Mon–Fri + next Mon–Fri).
 * Returns original start/end and the extended end date (second Friday).
 */
async function findTwoAvailableWeeks(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 20,
): Promise<{ startDate: string; endDate: string; newEndDate: string }> {
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
    const newEnd = new Date(start);
    newEnd.setDate(start.getDate() + 11); // second Friday

    const startIso = toIso(start);
    const endIso = toIso(end);
    const newEndIso = toIso(newEnd);

    // Check the full extended range is conflict-free
    if (!(await hasVacationConflict(db, login, startIso, newEndIso))) {
      return { startDate: startIso, endDate: endIso, newEndDate: newEndIso };
    }
  }
  throw new Error(
    `No two consecutive conflict-free weeks found for ${login}`,
  );
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

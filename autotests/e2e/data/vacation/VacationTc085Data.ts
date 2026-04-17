declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc085Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
  newEndDateIso: string;
}

/**
 * TC-VAC-085: Owner can edit own vacation (not PAID).
 * SETUP: API creates a NEW vacation for pvaynmaster (Mon-Fri).
 * Test: opens edit dialog, changes end date to Thursday, saves, verifies success.
 */
export class VacationTc085Data {
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
    username = process.env.VAC_TC085_USER ?? "pvaynmaster",
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
  ): Promise<VacationTc085Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc085Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc085Args>("VacationTc085Data");
      if (cached) {
        return new VacationTc085Data(
          cached.username,
          cached.startDateIso,
          cached.endDateIso,
          cached.newEndDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(db, username, 8);
      // New end = Thursday (one day before Friday)
      const thu = new Date(endDate);
      thu.setDate(thu.getDate() - 1);
      const newEndDate = toIso(thu);

      const args: Tc085Args = {
        username,
        startDateIso: startDate,
        endDateIso: endDate,
        newEndDateIso: newEndDate,
      };

      saveToDisk("VacationTc085Data", args);
      return new VacationTc085Data(
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

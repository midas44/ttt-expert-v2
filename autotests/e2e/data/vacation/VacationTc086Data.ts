declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc086Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-086: Owner cannot edit PAID vacation.
 * SETUP: API creates, approves, and pays a vacation for pvaynmaster.
 * Test: switches to Closed tab, verifies the PAID vacation has no edit button.
 * Also attempts an API PUT update which should return 400.
 */
export class VacationTc086Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly periodPattern: RegExp;

  constructor(
    username = process.env.VAC_TC086_USER ?? "pvaynmaster",
    startDateIso = "",
    endDateIso = "",
  ) {
    this.username = username;
    this.startDateIso = startDateIso;
    this.endDateIso = endDateIso;
    this.periodPattern = toPeriodPattern(startDateIso, endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc086Data> {
    const username = "pvaynmaster";

    if (mode === "static") return new VacationTc086Data(username);

    if (mode === "saved") {
      const cached = loadSaved<Tc086Args>("VacationTc086Data");
      if (cached) {
        return new VacationTc086Data(cached.username, cached.startDateIso, cached.endDateIso);
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(db, username, 9);

      const args: Tc086Args = { username, startDateIso: startDate, endDateIso: endDate };
      saveToDisk("VacationTc086Data", args);
      return new VacationTc086Data(args.username, args.startDateIso, args.endDateIso);
    } finally {
      await db.close();
    }
  }
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

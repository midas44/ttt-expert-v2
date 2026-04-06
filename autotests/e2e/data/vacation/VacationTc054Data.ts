declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc054Args {
  username: string;
  displayName: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-054: Availability chart — vacation display.
 * SETUP: API creates + approves a vacation for pvaynmaster.
 * Test: navigates to the availability chart and verifies the vacation is visible.
 */
export class VacationTc054Data {
  readonly username: string;
  readonly displayName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  /** Month number (1-based) from the vacation start date. */
  readonly startMonth: number;

  constructor(args: Tc054Args) {
    this.username = args.username;
    this.displayName = args.displayName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.startMonth = parseInt(args.startDateIso.split("-")[1], 10);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc054Data> {
    const username = "pvaynmaster";
    const displayName = "Weinmeister";

    if (mode === "static") {
      return new VacationTc054Data({
        username,
        displayName,
        startDateIso: "",
        endDateIso: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc054Args>("VacationTc054Data");
      if (cached) return new VacationTc054Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(db, username, 8);
      const args: Tc054Args = {
        username,
        displayName,
        startDateIso: startDate,
        endDateIso: endDate,
      };
      saveToDisk("VacationTc054Data", args);
      return new VacationTc054Data(args);
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
  throw new Error(`No conflict-free week found for ${login} within ${maxAttempts} weeks`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

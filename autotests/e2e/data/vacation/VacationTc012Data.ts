declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc012Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-012: Vacation events feed.
 * SETUP: API creates then deletes a vacation for pvaynmaster → generates timeline events.
 * Test: verifies the events feed panel shows recent activity.
 */
export class VacationTc012Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(args: Tc012Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc012Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc012Data({
        username,
        startDateIso: "",
        endDateIso: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc012Args>("VacationTc012Data");
      if (cached) return new VacationTc012Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(db, username, 12);
      const args: Tc012Args = {
        username,
        startDateIso: startDate,
        endDateIso: endDate,
      };
      saveToDisk("VacationTc012Data", args);
      return new VacationTc012Data(args);
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

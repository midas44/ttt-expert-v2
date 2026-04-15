declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc013Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-013: Delete PAID+NON-EXACT vacation (allowed).
 * Design issue: deleteVacation only guards PAID+EXACT. PAID+NON_EXACT passes through.
 * SETUP: API creates → approves → pays a NON_EXACT vacation for pvaynmaster.
 * Test: attempts DELETE via API and verifies it succeeds (exposing the design gap).
 */
export class VacationTc013Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(args: Tc013Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc013Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc013Data({
        username,
        startDateIso: "",
        endDateIso: "",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc013Args>("VacationTc013Data");
      if (cached) return new VacationTc013Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await findAvailableWeek(db, username, 14);
      const args: Tc013Args = {
        username,
        startDateIso: startDate,
        endDateIso: endDate,
      };
      saveToDisk("VacationTc013Data", args);
      return new VacationTc013Data(args);
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

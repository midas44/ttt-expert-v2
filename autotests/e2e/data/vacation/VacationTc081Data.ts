declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc081Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-081: Flash of irrelevant validation on first date pick (#3127).
 * Needs any employee who can create a vacation — just needs to open
 * the create dialog and pick a date. Using pvaynmaster with a conflict-free week.
 */
export class VacationTc081Data {
  readonly username: string;
  readonly startInput: string;
  readonly endInput: string;

  constructor(args: Tc081Args) {
    this.username = args.username;
    this.startInput = toCalendarFormat(args.startDateIso);
    this.endInput = toCalendarFormat(args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc081Data> {
    const username = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc081Data({
        username,
        startDateIso: "2026-08-10",
        endDateIso: "2026-08-14",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc081Args>("VacationTc081Data");
      if (cached) return new VacationTc081Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      const base = new Date(now);
      base.setDate(now.getDate() + daysToMon + 10 * 7);

      for (let i = 0; i < 30; i++) {
        const start = new Date(base);
        start.setDate(base.getDate() + i * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);

        const startIso = toIso(start);
        const endIso = toIso(end);

        if (!(await hasVacationConflict(db, username, startIso, endIso))) {
          const args: Tc081Args = { username, startDateIso: startIso, endDateIso: endIso };
          saveToDisk("VacationTc081Data", args);
          return new VacationTc081Data(args);
        }
      }
      throw new Error("No conflict-free week found for TC-VAC-081");
    } finally {
      await db.close();
    }
  }
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

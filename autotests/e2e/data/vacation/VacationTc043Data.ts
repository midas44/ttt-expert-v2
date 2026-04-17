declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc043Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-043: Null paymentMonth → server error (NPE bug).
 * Uses pvaynmaster (API_SECRET_TOKEN owner) with a conflict-free week.
 * The test POSTs with paymentMonth: null to trigger NPE in correctPaymentMonth().
 */
export class VacationTc043Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(args: Tc043Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc043Data> {
    if (mode === "static") {
      return new VacationTc043Data({
        username: "pvaynmaster",
        startDateIso: "2026-09-07",
        endDateIso: "2026-09-11",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc043Args>("VacationTc043Data");
      if (cached) return new VacationTc043Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const login = "pvaynmaster";
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;

      for (let w = 6; w < 50; w++) {
        const start = new Date(now);
        start.setDate(now.getDate() + daysToMon + w * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);
        const startIso = start.toISOString().slice(0, 10);
        const endIso = end.toISOString().slice(0, 10);

        if (!(await hasVacationConflict(db, login, startIso, endIso))) {
          const args: Tc043Args = {
            username: login,
            startDateIso: startIso,
            endDateIso: endIso,
          };
          saveToDisk("VacationTc043Data", args);
          return new VacationTc043Data(args);
        }
      }
      throw new Error("No conflict-free week found for pvaynmaster");
    } finally {
      await db.close();
    }
  }
}

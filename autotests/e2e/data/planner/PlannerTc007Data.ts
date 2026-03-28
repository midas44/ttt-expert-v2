declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithEmptyWeekend } from "./queries/plannerQueries";

interface Tc007Args {
  username: string;
  daysBack: number;
}

/**
 * TC-PLN-007: Empty state — no assignments for date.
 * Finds an employee and a recent weekend date with no task assignments.
 */
export class PlannerTc007Data {
  readonly username: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC007_USER ?? "pvaynmaster",
    daysBack = 6,
  ) {
    this.username = username;
    this.daysBack = daysBack;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc007Data> {
    if (mode === "static") return new PlannerTc007Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc007Args>("PlannerTc007Data");
      if (cached) return new PlannerTc007Data(cached.username, cached.daysBack);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithEmptyWeekend(db);
      const args: Tc007Args = {
        username: emp.login,
        daysBack: emp.days_back,
      };
      if (mode === "saved") saveToDisk("PlannerTc007Data", args);
      return new PlannerTc007Data(args.username, args.daysBack);
    } finally {
      await db.close();
    }
  }
}

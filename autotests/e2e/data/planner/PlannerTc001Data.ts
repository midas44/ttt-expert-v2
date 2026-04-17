declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEnabledEmployee } from "./queries/plannerQueries";

interface Tc001Args {
  username: string;
}

/**
 * TC-PLN-001: Navigate to Planner from navbar.
 * Needs any authenticated employee.
 */
export class PlannerTc001Data {
  readonly username: string;

  constructor(username = process.env.PLN_TC001_USER ?? "pvaynmaster") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc001Data> {
    if (mode === "static") return new PlannerTc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("PlannerTc001Data");
      if (cached) return new PlannerTc001Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEnabledEmployee(db);
      const args: Tc001Args = { username: emp.login };
      saveToDisk("PlannerTc001Data", args);
      return new PlannerTc001Data(args.username);
    } finally {
      await db.close();
    }
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEnabledEmployee } from "./queries/plannerQueries";

interface Tc002Args {
  username: string;
}

/**
 * TC-PLN-002: Switch between Tasks and Projects tabs.
 * Needs any authenticated employee.
 */
export class PlannerTc002Data {
  readonly username: string;

  constructor(username = process.env.PLN_TC002_USER ?? "pvaynmaster") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc002Data> {
    if (mode === "static") return new PlannerTc002Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc002Args>("PlannerTc002Data");
      if (cached) return new PlannerTc002Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEnabledEmployee(db);
      const args: Tc002Args = { username: emp.login };
      saveToDisk("PlannerTc002Data", args);
      return new PlannerTc002Data(args.username);
    } finally {
      await db.close();
    }
  }
}

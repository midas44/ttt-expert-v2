declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEnabledEmployee } from "./queries/plannerQueries";

interface Tc003Args {
  username: string;
}

/**
 * TC-PLN-003: Navigate dates forward and backward.
 * Needs any authenticated employee.
 */
export class PlannerTc003Data {
  readonly username: string;

  constructor(username = process.env.PLN_TC003_USER ?? "pvaynmaster") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc003Data> {
    if (mode === "static") return new PlannerTc003Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc003Args>("PlannerTc003Data");
      if (cached) return new PlannerTc003Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEnabledEmployee(db);
      const args: Tc003Args = { username: emp.login };
      saveToDisk("PlannerTc003Data", args);
      return new PlannerTc003Data(args.username);
    } finally {
      await db.close();
    }
  }
}

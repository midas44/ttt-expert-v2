declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithMultipleProjectAssignments } from "./queries/plannerQueries";

interface Tc008Args {
  username: string;
}

/**
 * TC-PLN-008: Collapse and expand project groups in Tasks tab.
 * Needs an employee with task assignments in at least 2 different projects.
 */
export class PlannerTc008Data {
  readonly username: string;

  constructor(username = process.env.PLN_TC008_USER ?? "pvaynmaster") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc008Data> {
    if (mode === "static") return new PlannerTc008Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc008Args>("PlannerTc008Data");
      if (cached) return new PlannerTc008Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithMultipleProjectAssignments(db);
      const args: Tc008Args = { username: emp.login };
      if (mode === "saved") saveToDisk("PlannerTc008Data", args);
      return new PlannerTc008Data(args.username);
    } finally {
      await db.close();
    }
  }
}

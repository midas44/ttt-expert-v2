declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithAssignment } from "./queries/plannerQueries";

interface Tc010Args {
  username: string;
}

/**
 * TC-PLN-010: Task view toggle — TASK vs TICKET.
 * Needs an employee with task assignments to see the table header toggle.
 */
export class PlannerTc010Data {
  readonly username: string;

  constructor(username = process.env.PLN_TC010_USER ?? "pvaynmaster") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc010Data> {
    if (mode === "static") return new PlannerTc010Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc010Args>("PlannerTc010Data");
      if (cached) return new PlannerTc010Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithAssignment(db);
      const args: Tc010Args = { username: emp.login };
      if (mode === "saved") saveToDisk("PlannerTc010Data", args);
      return new PlannerTc010Data(args.username);
    } finally {
      await db.close();
    }
  }
}

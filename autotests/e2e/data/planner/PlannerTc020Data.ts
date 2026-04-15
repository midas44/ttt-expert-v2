declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithTrackerInfo } from "./queries/plannerQueries";

interface Tc020Args {
  username: string;
  projectName: string;
}

/**
 * TC-PLN-020: Info column shows tracker priority tags.
 * Needs a PM whose project has tasks with non-empty ticket_info.
 */
export class PlannerTc020Data {
  readonly username: string;
  readonly projectName: string;

  constructor(
    username = process.env.PLN_TC020_USER ?? "pvaynmaster",
    projectName = "Noveo",
  ) {
    this.username = username;
    this.projectName = projectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc020Data> {
    if (mode === "static") return new PlannerTc020Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc020Args>("PlannerTc020Data");
      if (cached)
        return new PlannerTc020Data(cached.username, cached.projectName);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithTrackerInfo(db);
      const args: Tc020Args = {
        username: row.login,
        projectName: row.project_name,
      };
      saveToDisk("PlannerTc020Data", args);
      return new PlannerTc020Data(args.username, args.projectName);
    } finally {
      await db.close();
    }
  }
}

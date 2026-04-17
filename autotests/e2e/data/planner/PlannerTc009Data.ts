declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectManager } from "./queries/plannerQueries";

interface Tc009Args {
  username: string;
  projectName: string;
}

/**
 * TC-PLN-009: WebSocket connection indicator.
 * Needs a PM to access Projects tab and select their project.
 */
export class PlannerTc009Data {
  readonly username: string;
  readonly projectName: string;

  constructor(
    username = process.env.PLN_TC009_USER ?? "pvaynmaster",
    projectName = "Noveo",
  ) {
    this.username = username;
    this.projectName = projectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc009Data> {
    if (mode === "static") return new PlannerTc009Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc009Args>("PlannerTc009Data");
      if (cached)
        return new PlannerTc009Data(cached.username, cached.projectName);
    }

    const db = new DbClient(tttConfig);
    try {
      const pm = await findProjectManager(db);
      const args: Tc009Args = {
        username: pm.login,
        projectName: pm.project_name,
      };
      saveToDisk("PlannerTc009Data", args);
      return new PlannerTc009Data(args.username, args.projectName);
    } finally {
      await db.close();
    }
  }
}

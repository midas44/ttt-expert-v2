declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectManager } from "./queries/plannerQueries";

interface Tc004Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-PLN-004: Select a project in Projects tab.
 * Needs a PM user with at least one ACTIVE project.
 */
export class PlannerTc004Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.PLN_TC004_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc004Data> {
    if (mode === "static") return new PlannerTc004Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc004Args>("PlannerTc004Data");
      if (cached) {
        return new PlannerTc004Data(
          cached.username,
          cached.projectId,
          cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const pm = await findProjectManager(db);
      const args: Tc004Args = {
        username: pm.login,
        projectId: pm.project_id,
        projectName: pm.project_name,
      };
      saveToDisk("PlannerTc004Data", args);
      return new PlannerTc004Data(
        args.username,
        args.projectId,
        args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

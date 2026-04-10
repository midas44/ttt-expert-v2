declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc032Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-032: Bug 4 regression — OK button present in Tasks Closing tab.
 * Verifies the OK button is visible and clickable on the Tasks closing tab.
 * Bug was that OK button was missing from Tasks closing tab (fixed by !5313).
 */
export class T2724Tc032Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.T2724_TC032_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc032Data> {
    if (mode === "static") return new T2724Tc032Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc032Args>("T2724Tc032Data");
      if (cached) {
        return new T2724Tc032Data(
          cached.username, cached.projectId, cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithManager(db);
      const args: Tc032Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
      };
      saveToDisk("T2724Tc032Data", args);
      return new T2724Tc032Data(
        args.username, args.projectId, args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

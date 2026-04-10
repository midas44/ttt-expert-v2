declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc031Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-031: Bug 3 regression — correct column header in Tasks Closing tab.
 * Verifies the column header reads "Tags for closing tasks" (EN) / "Теги для закрытия задач" (RU),
 * not "Role on the project" which was the original bug (fixed by !5313).
 */
export class T2724Tc031Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.T2724_TC031_USER ?? "dergachev",
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
  ): Promise<T2724Tc031Data> {
    if (mode === "static") return new T2724Tc031Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc031Args>("T2724Tc031Data");
      if (cached) {
        return new T2724Tc031Data(
          cached.username, cached.projectId, cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithManager(db);
      const args: Tc031Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
      };
      saveToDisk("T2724Tc031Data", args);
      return new T2724Tc031Data(
        args.username, args.projectId, args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc036Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-036: Informational text on Tasks Closing tab.
 * Verifies the explanatory text is present in both EN and RU.
 */
export class T2724Tc036Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.T2724_TC036_USER ?? "dergachev",
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
  ): Promise<T2724Tc036Data> {
    if (mode === "static") return new T2724Tc036Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc036Args>("T2724Tc036Data");
      if (cached) {
        return new T2724Tc036Data(
          cached.username, cached.projectId, cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithManager(db);
      const args: Tc036Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
      };
      saveToDisk("T2724Tc036Data", args);
      return new T2724Tc036Data(
        args.username, args.projectId, args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

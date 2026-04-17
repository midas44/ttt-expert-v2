declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc030Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-030: Bug 1 regression — popup closes only via OK button.
 * Verifies the Project Settings modal cannot be closed by clicking outside.
 * Only the OK button should close it (confirmed by design in #2724 comment 908000).
 */
export class T2724Tc030Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.T2724_TC030_USER ?? "dergachev",
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
  ): Promise<T2724Tc030Data> {
    if (mode === "static") return new T2724Tc030Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc030Args>("T2724Tc030Data");
      if (cached) {
        return new T2724Tc030Data(
          cached.username, cached.projectId, cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithManager(db);
      const args: Tc030Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
      };
      saveToDisk("T2724Tc030Data", args);
      return new T2724Tc030Data(
        args.username, args.projectId, args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

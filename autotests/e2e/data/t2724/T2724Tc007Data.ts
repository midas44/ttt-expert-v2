declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc007Args {
  username: string;
  projectId: number;
  projectName: string;
  tagValue: string;
}

/**
 * TC-T2724-007: Delete a tag — happy path.
 * Needs a PM and project. Tag is created via API, then deleted via UI.
 */
export class T2724Tc007Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC007_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagValue = "to-delete",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc007Data> {
    if (mode === "static") return new T2724Tc007Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc007Args>("T2724Tc007Data");
      if (cached) {
        return new T2724Tc007Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tagValue,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const args: Tc007Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagValue: `del-${Date.now()}`,
      };
      saveToDisk("T2724Tc007Data", args);
      return new T2724Tc007Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tagValue,
      );
    } finally {
      await db.close();
    }
  }
}

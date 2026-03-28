declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc001Args {
  username: string;
  projectId: number;
  projectName: string;
  tagValue: string;
}

/**
 * TC-T2724-001: Create a close tag — happy path.
 * Needs a PM/SPM user and an enabled project they manage.
 */
export class T2724Tc001Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC001_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagValue = "[closed]",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc001Data> {
    if (mode === "static") return new T2724Tc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("T2724Tc001Data");
      if (cached) {
        return new T2724Tc001Data(
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
      const args: Tc001Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagValue: `[autotest-${Date.now()}]`,
      };
      if (mode === "saved") saveToDisk("T2724Tc001Data", args);
      return new T2724Tc001Data(
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

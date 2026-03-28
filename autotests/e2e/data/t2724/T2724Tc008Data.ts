declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithNoTags } from "./queries/t2724Queries";

interface Tc008Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-008: List tags — empty state.
 * Needs a PM and a project with no existing close tags.
 */
export class T2724Tc008Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.T2724_TC008_USER ?? "pvaynmaster",
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
  ): Promise<T2724Tc008Data> {
    if (mode === "static") return new T2724Tc008Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc008Args>("T2724Tc008Data");
      if (cached) {
        return new T2724Tc008Data(
          cached.username,
          cached.projectId,
          cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithNoTags(db);
      const args: Tc008Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
      };
      if (mode === "saved") saveToDisk("T2724Tc008Data", args);
      return new T2724Tc008Data(
        args.username,
        args.projectId,
        args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

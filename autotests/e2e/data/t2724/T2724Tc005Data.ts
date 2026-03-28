declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc005Args {
  username: string;
  projectId: number;
  projectName: string;
  tagValue: string;
}

/**
 * TC-T2724-005: Inline edit — Escape cancels without saving.
 * Needs a PM and project. Tag is created via API, edit started, then Escape pressed.
 */
export class T2724Tc005Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC005_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagValue = "original-tag",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc005Data> {
    if (mode === "static") return new T2724Tc005Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc005Args>("T2724Tc005Data");
      if (cached) {
        return new T2724Tc005Data(
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
      const args: Tc005Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagValue: `esc-test-${Date.now()}`,
      };
      if (mode === "saved") saveToDisk("T2724Tc005Data", args);
      return new T2724Tc005Data(
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

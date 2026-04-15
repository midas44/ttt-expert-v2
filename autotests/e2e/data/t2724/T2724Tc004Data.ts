declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc004Args {
  username: string;
  projectId: number;
  projectName: string;
  originalTag: string;
  updatedTag: string;
}

/**
 * TC-T2724-004: Inline edit a tag — happy path.
 * Needs a PM and project. Tag is created via API, then edited inline.
 */
export class T2724Tc004Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly originalTag: string;
  readonly updatedTag: string;

  constructor(
    username = process.env.T2724_TC004_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    originalTag = "test-tag",
    updatedTag = "updated-tag",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.originalTag = originalTag;
    this.updatedTag = updatedTag;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc004Data> {
    if (mode === "static") return new T2724Tc004Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc004Args>("T2724Tc004Data");
      if (cached) {
        return new T2724Tc004Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.originalTag,
          cached.updatedTag,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const ts = Date.now();
      const args: Tc004Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        originalTag: `edit-orig-${ts}`,
        updatedTag: `edit-upd-${ts}`,
      };
      saveToDisk("T2724Tc004Data", args);
      return new T2724Tc004Data(
        args.username,
        args.projectId,
        args.projectName,
        args.originalTag,
        args.updatedTag,
      );
    } finally {
      await db.close();
    }
  }
}

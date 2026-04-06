declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithSeniorManager } from "./queries/t2724Queries";

interface Tc011Args {
  username: string;
  projectId: number;
  projectName: string;
  tagCreate: string;
}

/**
 * TC-T2724-011: Permission — senior manager can CRUD tags.
 * Finds a project where the user is SPM (senior_manager_id).
 */
export class T2724Tc011Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagCreate: string;

  constructor(
    username = process.env.T2724_TC011_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagCreate = "spm-test",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagCreate = tagCreate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc011Data> {
    if (mode === "static") return new T2724Tc011Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc011Args>("T2724Tc011Data");
      if (cached) {
        return new T2724Tc011Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tagCreate,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithSeniorManager(db);
      const args: Tc011Args = {
        username: proj.spm_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagCreate: `spm-${Date.now()}`,
      };
      saveToDisk("T2724Tc011Data", args);
      return new T2724Tc011Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tagCreate,
      );
    } finally {
      await db.close();
    }
  }
}

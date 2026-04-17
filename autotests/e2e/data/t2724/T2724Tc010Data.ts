declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc010Args {
  username: string;
  projectId: number;
  projectName: string;
  tagCreate: string;
  tagEdited: string;
}

/**
 * TC-T2724-010: Permission — PM can CRUD tags.
 * Full create-edit-delete cycle by a PM on their project. Self-cleaning.
 */
export class T2724Tc010Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagCreate: string;
  readonly tagEdited: string;

  constructor(
    username = process.env.T2724_TC010_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagCreate = "pm-test",
    tagEdited = "pm-updated",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagCreate = tagCreate;
    this.tagEdited = tagEdited;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc010Data> {
    if (mode === "static") return new T2724Tc010Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc010Args>("T2724Tc010Data");
      if (cached) {
        return new T2724Tc010Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tagCreate,
          cached.tagEdited,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const ts = Date.now();
      const args: Tc010Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagCreate: `crud-${ts}`,
        tagEdited: `crud-upd-${ts}`,
      };
      saveToDisk("T2724Tc010Data", args);
      return new T2724Tc010Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tagCreate,
        args.tagEdited,
      );
    } finally {
      await db.close();
    }
  }
}

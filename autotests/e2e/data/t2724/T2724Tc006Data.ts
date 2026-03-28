declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc006Args {
  username: string;
  projectId: number;
  projectName: string;
  tagA: string;
  tagB: string;
}

/**
 * TC-T2724-006: Edit tag to duplicate value — validation error.
 * Needs a PM, project, and two distinct tags. Editing tag-b to tag-a should fail.
 */
export class T2724Tc006Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagA: string;
  readonly tagB: string;

  constructor(
    username = process.env.T2724_TC006_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagA = "tag-a",
    tagB = "tag-b",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagA = tagA;
    this.tagB = tagB;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc006Data> {
    if (mode === "static") return new T2724Tc006Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc006Args>("T2724Tc006Data");
      if (cached) {
        return new T2724Tc006Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tagA,
          cached.tagB,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const ts = Date.now();
      const args: Tc006Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagA: `dup-a-${ts}`,
        tagB: `dup-b-${ts}`,
      };
      if (mode === "saved") saveToDisk("T2724Tc006Data", args);
      return new T2724Tc006Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tagA,
        args.tagB,
      );
    } finally {
      await db.close();
    }
  }
}

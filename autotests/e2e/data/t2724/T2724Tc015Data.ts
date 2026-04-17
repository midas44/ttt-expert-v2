declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc015Args {
  username: string;
  projectId: number;
  projectName: string;
  tags: string[];
}

/**
 * TC-T2724-015: Multiple tags — create 5+ tags for a project.
 * Verifies the system supports multiple tags per project with no max limit.
 */
export class T2724Tc015Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tags: string[];

  constructor(
    username = process.env.T2724_TC015_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tags = ["[closed]", "[done]", "[resolved]", "finished", "cancelled"],
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tags = tags;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc015Data> {
    if (mode === "static") return new T2724Tc015Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc015Args>("T2724Tc015Data");
      if (cached) {
        return new T2724Tc015Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tags,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const ts = Date.now();
      const args: Tc015Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tags: [
          `closed-${ts}`,
          `done-${ts}`,
          `resolved-${ts}`,
          `finished-${ts}`,
          `cancelled-${ts}`,
        ],
      };
      saveToDisk("T2724Tc015Data", args);
      return new T2724Tc015Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tags,
      );
    } finally {
      await db.close();
    }
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc003Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-003: Create blank/whitespace tag — validation error.
 * Needs a PM and project. Tests that blank tags are rejected.
 */
export class T2724Tc003Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;

  constructor(
    username = process.env.T2724_TC003_USER ?? "pvaynmaster",
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
  ): Promise<T2724Tc003Data> {
    if (mode === "static") return new T2724Tc003Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc003Args>("T2724Tc003Data");
      if (cached) {
        return new T2724Tc003Data(
          cached.username,
          cached.projectId,
          cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const args: Tc003Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
      };
      if (mode === "saved") saveToDisk("T2724Tc003Data", args);
      return new T2724Tc003Data(
        args.username,
        args.projectId,
        args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

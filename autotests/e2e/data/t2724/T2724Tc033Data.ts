declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findHeavyDataProject } from "./queries/t2724Queries";

interface Tc033Args {
  username: string;
  projectId: number;
  projectName: string;
  assignmentCount: number;
}

/**
 * TC-T2724-033: Bug 6 — cannot reopen popup on heavy data project.
 * After adding close tags on a heavy data project, reopening Project Settings
 * may hang with spinner. This test documents whether Bug 6 is still reproducible.
 */
export class T2724Tc033Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentCount: number;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC033_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentCount = 5000,
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignmentCount = assignmentCount;
    this.tagValue = `__autotest_heavy_${Date.now()}__`;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc033Data> {
    if (mode === "static") return new T2724Tc033Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc033Args>("T2724Tc033Data");
      if (cached) {
        return new T2724Tc033Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignmentCount,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findHeavyDataProject(db);
      const args: Tc033Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentCount: row.assignment_count,
      };
      saveToDisk("T2724Tc033Data", args);
      return new T2724Tc033Data(
        args.username, args.projectId, args.projectName,
        args.assignmentCount,
      );
    } finally {
      await db.close();
    }
  }
}

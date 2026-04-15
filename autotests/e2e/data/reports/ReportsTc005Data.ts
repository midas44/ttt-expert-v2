declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findTaskToAdd } from "./queries/reportQueries";

interface Tc005Args {
  username: string;
  taskName: string;
  projectName: string;
}

/**
 * TC-RPT-005: Add new task on My Tasks page.
 * Finds an employee with a project task that isn't on their grid yet,
 * then adds it via the "Add task" search.
 */
export class ReportsTc005Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly projectName: string;
  /** Short search term — first 10 chars of task name for search input. */
  readonly searchTerm: string;

  constructor(
    username = process.env.RPT_TC005_USER ?? "pvaynmaster",
    taskName = "Development",
    projectName = "TTT",
  ) {
    this.username = username;
    this.taskName = taskName;
    const shortName = taskName.substring(0, 40);
    this.taskPattern = new RegExp(
      shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.projectName = projectName;
    // Use first 15 chars of task name — specific enough to narrow autocomplete
    this.searchTerm = taskName.substring(0, 15);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc005Data> {
    if (mode === "static") return new ReportsTc005Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc005Args>("ReportsTc005Data");
      if (cached) {
        return new ReportsTc005Data(
          cached.username,
          cached.taskName,
          cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const result = await findTaskToAdd(db);
      const args: Tc005Args = {
        username: result.login,
        taskName: result.taskName,
        projectName: result.projectName,
      };
      saveToDisk("ReportsTc005Data", args);
      return new ReportsTc005Data(
        args.username,
        args.taskName,
        args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

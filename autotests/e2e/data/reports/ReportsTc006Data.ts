declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithMultipleTasks } from "./queries/reportQueries";

interface Tc006Args {
  username: string;
  task1Name: string;
  task2Name: string;
}

/**
 * TC-RPT-006: Pin/unpin task.
 * Needs an employee with at least 2 pinned tasks so we can verify
 * pin ordering after unpinning one.
 */
export class ReportsTc006Data {
  readonly username: string;
  readonly task1Name: string;
  readonly task1Pattern: RegExp;
  readonly task2Name: string;
  readonly task2Pattern: RegExp;

  constructor(
    username = process.env.RPT_TC006_USER ?? "pvaynmaster",
    task1Name = "Development",
    task2Name = "Testing",
  ) {
    this.username = username;
    this.task1Name = task1Name;
    this.task1Pattern = new RegExp(
      task1Name.substring(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.task2Name = task2Name;
    this.task2Pattern = new RegExp(
      task2Name.substring(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc006Data> {
    if (mode === "static") return new ReportsTc006Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc006Args>("ReportsTc006Data");
      if (cached) {
        return new ReportsTc006Data(
          cached.username,
          cached.task1Name,
          cached.task2Name,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithMultipleTasks(db);
      const args: Tc006Args = {
        username: emp.login,
        task1Name: emp.task1Name,
        task2Name: emp.task2Name,
      };
      saveToDisk("ReportsTc006Data", args);
      return new ReportsTc006Data(args.username, args.task1Name, args.task2Name);
    } finally {
      await db.close();
    }
  }
}

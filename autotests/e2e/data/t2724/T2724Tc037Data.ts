declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc037Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-037: Confluence discrepancy — 200 char limit not enforced.
 * Tests boundary behavior of tag input: Confluence says 200, DB allows 255,
 * frontend has no maxLength attribute.
 */
export class T2724Tc037Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  /** A 201-character test tag to verify the limit is NOT enforced. */
  readonly longTag: string;

  constructor(
    username = process.env.T2724_TC037_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    // 201 chars: exceeds Confluence's 200-char spec but within DB's 255 limit
    this.longTag = "tc037-boundary-" + "x".repeat(201 - "tc037-boundary-".length);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc037Data> {
    if (mode === "static") return new T2724Tc037Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc037Args>("T2724Tc037Data");
      if (cached) {
        return new T2724Tc037Data(
          cached.username, cached.projectId, cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithManager(db);
      const args: Tc037Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
      };
      saveToDisk("T2724Tc037Data", args);
      return new T2724Tc037Data(
        args.username, args.projectId, args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

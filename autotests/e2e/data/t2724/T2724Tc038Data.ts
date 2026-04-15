declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc038Args {
  username: string;
  projectId: number;
  projectName: string;
}

/**
 * TC-T2724-038: Apply error handling — silent failure on backend error.
 * Tests that when apply endpoint returns 500, the frontend silently swallows
 * the error (devLog only) — no user-facing error notification, no page reload.
 * Known design issue: both frontend (catch→devLog) and backend (catch→log.debug)
 * silently swallow errors.
 */
export class T2724Tc038Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  /** Tag to add so the apply flow is triggered (not skipped by empty-tags guard). */
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC038_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagValue = "tc038-error-test";
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc038Data> {
    if (mode === "static") return new T2724Tc038Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc038Args>("T2724Tc038Data");
      if (cached) {
        return new T2724Tc038Data(
          cached.username, cached.projectId, cached.projectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithManager(db);
      const args: Tc038Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
      };
      saveToDisk("T2724Tc038Data", args);
      return new T2724Tc038Data(
        args.username, args.projectId, args.projectName,
      );
    } finally {
      await db.close();
    }
  }
}

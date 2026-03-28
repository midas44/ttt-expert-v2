declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc014Args {
  username: string;
  projectId: number;
  projectName: string;
  tag255: string;
  tag256: string;
}

/**
 * TC-T2724-014: Long tag near VARCHAR(255) limit.
 * Tests boundary: 255 chars should succeed, 256 may truncate or error.
 */
export class T2724Tc014Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tag255: string;
  readonly tag256: string;

  constructor(
    username = process.env.T2724_TC014_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tag255 = "A".repeat(255),
    tag256 = "A".repeat(256),
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tag255 = tag255;
    this.tag256 = tag256;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc014Data> {
    if (mode === "static") return new T2724Tc014Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc014Args>("T2724Tc014Data");
      if (cached) {
        return new T2724Tc014Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tag255,
          cached.tag256,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const ts = String(Date.now());
      // Fill to exactly 255 chars: prefix + padding
      const prefix255 = `long-${ts}-`;
      const tag255 = prefix255 + "X".repeat(255 - prefix255.length);
      const prefix256 = `long-${ts}-Y`;
      const tag256 = prefix256 + "X".repeat(256 - prefix256.length);

      const args: Tc014Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tag255,
        tag256,
      };
      if (mode === "saved") saveToDisk("T2724Tc014Data", args);
      return new T2724Tc014Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tag255,
        args.tag256,
      );
    } finally {
      await db.close();
    }
  }
}

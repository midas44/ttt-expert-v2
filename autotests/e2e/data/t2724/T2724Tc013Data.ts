declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithManager } from "./queries/t2724Queries";

interface Tc013Args {
  username: string;
  projectId: number;
  projectName: string;
  tagUnicode: string;
  tagCyrillic: string;
  tagXss: string;
}

/**
 * TC-T2724-013: Special characters in tag — Unicode, Cyrillic.
 * Creates tags with non-ASCII characters and verifies storage.
 */
export class T2724Tc013Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagUnicode: string;
  readonly tagCyrillic: string;
  readonly tagXss: string;

  constructor(
    username = process.env.T2724_TC013_USER ?? "pvaynmaster",
    projectId = 1,
    projectName = "Test Project",
    tagUnicode = "Done / Résolu",
    tagCyrillic = "Закрыто",
    tagXss = "<script>alert(1)</script>",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagUnicode = tagUnicode;
    this.tagCyrillic = tagCyrillic;
    this.tagXss = tagXss;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc013Data> {
    if (mode === "static") return new T2724Tc013Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc013Args>("T2724Tc013Data");
      if (cached) {
        return new T2724Tc013Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.tagUnicode,
          cached.tagCyrillic,
          cached.tagXss,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithManager(db);
      const ts = Date.now();
      const args: Tc013Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        tagUnicode: `Résolu-${ts}`,
        tagCyrillic: `Закрыто-${ts}`,
        tagXss: `<b>xss-${ts}</b>`,
      };
      if (mode === "saved") saveToDisk("T2724Tc013Data", args);
      return new T2724Tc013Data(
        args.username,
        args.projectId,
        args.projectName,
        args.tagUnicode,
        args.tagCyrillic,
        args.tagXss,
      );
    } finally {
      await db.close();
    }
  }
}

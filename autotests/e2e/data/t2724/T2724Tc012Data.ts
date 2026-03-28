declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findTwoProjectsWithDifferentManagers } from "./queries/t2724Queries";

interface Tc012Args {
  pmALogin: string;
  projectAId: number;
  projectAName: string;
  pmBLogin: string;
  projectBId: number;
  projectBName: string;
  tagValue: string;
}

/**
 * TC-T2724-012: Cross-project tag access — rejected.
 * Needs two distinct projects with different PMs.
 * PM of B tries to delete/edit a tag from project A.
 */
export class T2724Tc012Data {
  readonly pmALogin: string;
  readonly projectAId: number;
  readonly projectAName: string;
  readonly pmBLogin: string;
  readonly projectBId: number;
  readonly projectBName: string;
  readonly tagValue: string;

  constructor(
    pmALogin = process.env.T2724_TC012_PM_A ?? "pvaynmaster",
    projectAId = 1,
    projectAName = "Project A",
    pmBLogin = process.env.T2724_TC012_PM_B ?? "employee1",
    projectBId = 2,
    projectBName = "Project B",
    tagValue = "cross-test",
  ) {
    this.pmALogin = pmALogin;
    this.projectAId = projectAId;
    this.projectAName = projectAName;
    this.pmBLogin = pmBLogin;
    this.projectBId = projectBId;
    this.projectBName = projectBName;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc012Data> {
    if (mode === "static") return new T2724Tc012Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc012Args>("T2724Tc012Data");
      if (cached) {
        return new T2724Tc012Data(
          cached.pmALogin,
          cached.projectAId,
          cached.projectAName,
          cached.pmBLogin,
          cached.projectBId,
          cached.projectBName,
          cached.tagValue,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findTwoProjectsWithDifferentManagers(db);
      const args: Tc012Args = {
        pmALogin: row.pm_a_login,
        projectAId: row.project_a_id,
        projectAName: row.project_a_name,
        pmBLogin: row.pm_b_login,
        projectBId: row.project_b_id,
        projectBName: row.project_b_name,
        tagValue: `cross-${Date.now()}`,
      };
      if (mode === "saved") saveToDisk("T2724Tc012Data", args);
      return new T2724Tc012Data(
        args.pmALogin,
        args.projectAId,
        args.projectAName,
        args.pmBLogin,
        args.projectBId,
        args.projectBName,
        args.tagValue,
      );
    } finally {
      await db.close();
    }
  }
}

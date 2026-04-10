declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithMultipleRoles,
  findProjectManager,
} from "./queries/plannerQueries";

interface Tc005Args {
  username: string;
  pmProjectName: string;
  memberProjectName: string;
}

/**
 * TC-PLN-005: Filter by role — "Show projects where I am a ..."
 * Needs a user who is PM on one project and member on another.
 * Falls back to a PM-only user if no multi-role user found.
 */
export class PlannerTc005Data {
  readonly username: string;
  readonly pmProjectName: string;
  readonly memberProjectName: string;

  constructor(
    username = process.env.PLN_TC005_USER ?? "pvaynmaster",
    pmProjectName = "PM Project",
    memberProjectName = "Member Project",
  ) {
    this.username = username;
    this.pmProjectName = pmProjectName;
    this.memberProjectName = memberProjectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc005Data> {
    if (mode === "static") return new PlannerTc005Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc005Args>("PlannerTc005Data");
      if (cached) {
        return new PlannerTc005Data(
          cached.username,
          cached.pmProjectName,
          cached.memberProjectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      let args: Tc005Args;
      try {
        const multi = await findEmployeeWithMultipleRoles(db);
        args = {
          username: multi.login,
          pmProjectName: multi.pm_project_name,
          memberProjectName: multi.member_project_name,
        };
      } catch {
        // Fallback: PM user, test will only verify PM filter
        const pm = await findProjectManager(db);
        args = {
          username: pm.login,
          pmProjectName: pm.project_name,
          memberProjectName: pm.project_name,
        };
      }
      saveToDisk("PlannerTc005Data", args);
      return new PlannerTc005Data(
        args.username,
        args.pmProjectName,
        args.memberProjectName,
      );
    } finally {
      await db.close();
    }
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findProjectWithPlainMember,
} from "./queries/t2724Queries";

interface Tc009Args {
  pmLogin: string;
  memberLogin: string;
  projectId: number;
  projectName: string;
  tagValue: string;
}

/**
 * TC-T2724-009: Permission — employee can list tags but cannot create.
 * Needs a PM, their project, a plain member (not PM) on that project, and a tag.
 */
export class T2724Tc009Data {
  readonly pmLogin: string;
  readonly memberLogin: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly tagValue: string;

  constructor(
    pmLogin = process.env.T2724_TC009_PM ?? "pvaynmaster",
    memberLogin = process.env.T2724_TC009_MEMBER ?? "employee1",
    projectId = 1,
    projectName = "Test Project",
    tagValue = "perm-test",
  ) {
    this.pmLogin = pmLogin;
    this.memberLogin = memberLogin;
    this.projectId = projectId;
    this.projectName = projectName;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc009Data> {
    if (mode === "static") return new T2724Tc009Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc009Args>("T2724Tc009Data");
      if (cached) {
        return new T2724Tc009Data(
          cached.pmLogin,
          cached.memberLogin,
          cached.projectId,
          cached.projectName,
          cached.tagValue,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithPlainMember(db);
      const args: Tc009Args = {
        pmLogin: row.pm_login,
        memberLogin: row.member_login,
        projectId: row.project_id,
        projectName: row.project_name,
        tagValue: `perm-${Date.now()}`,
      };
      saveToDisk("T2724Tc009Data", args);
      return new T2724Tc009Data(
        args.pmLogin,
        args.memberLogin,
        args.projectId,
        args.projectName,
        args.tagValue,
      );
    } finally {
      await db.close();
    }
  }
}

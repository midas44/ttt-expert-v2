declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findProjectWithNoTags,
  findUnclosedAssignmentForProject,
} from "./queries/t2724Queries";

interface Tc022Args {
  username: string;
  projectId: number;
  projectName: string;
  witnessAssignmentId: number | null;
  witnessAssignmentDate: string | null;
}

/**
 * TC-T2724-022: Apply with no tags — no-op behavior.
 * Project has NO close tags. Apply should succeed (200) but change nothing.
 * Optional witness assignment used to verify no side effects.
 */
export class T2724Tc022Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly witnessAssignmentId: number | null;
  readonly witnessAssignmentDate: string | null;

  constructor(
    username = process.env.T2724_TC022_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    witnessAssignmentId: number | null = null,
    witnessAssignmentDate: string | null = null,
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.witnessAssignmentId = witnessAssignmentId;
    this.witnessAssignmentDate = witnessAssignmentDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc022Data> {
    if (mode === "static") return new T2724Tc022Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc022Args>("T2724Tc022Data");
      if (cached) {
        return new T2724Tc022Data(
          cached.username, cached.projectId, cached.projectName,
          cached.witnessAssignmentId, cached.witnessAssignmentDate,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const proj = await findProjectWithNoTags(db);
      const witness = await findUnclosedAssignmentForProject(db, proj.project_id);
      const args: Tc022Args = {
        username: proj.manager_login,
        projectId: proj.project_id,
        projectName: proj.project_name,
        witnessAssignmentId: witness?.assignment_id ?? null,
        witnessAssignmentDate: witness?.assignment_date ?? null,
      };
      if (mode === "saved") saveToDisk("T2724Tc022Data", args);
      return new T2724Tc022Data(
        args.username, args.projectId, args.projectName,
        args.witnessAssignmentId, args.witnessAssignmentDate,
      );
    } finally {
      await db.close();
    }
  }
}

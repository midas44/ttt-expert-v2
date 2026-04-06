declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findBlankTicketInfoAssignment } from "./queries/t2724Queries";

interface Tc028Args {
  username: string;
  projectId: number;
  projectName: string;
  assignmentId: number;
  assignmentDate: string;
  taskId: number;
}

/**
 * TC-T2724-028: Apply — assignment with blank ticket_info is skipped.
 * Finds an unclosed assignment where task.ticket_info is NULL or empty.
 * After apply, verifies the assignment remains open (not closed).
 */
export class T2724Tc028Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;

  constructor(
    username = process.env.T2724_TC028_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignmentId = assignmentId;
    this.assignmentDate = assignmentDate;
    this.taskId = taskId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc028Data> {
    if (mode === "static") return new T2724Tc028Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc028Args>("T2724Tc028Data");
      if (cached) {
        return new T2724Tc028Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignmentId, cached.assignmentDate, cached.taskId,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findBlankTicketInfoAssignment(db);
      const args: Tc028Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
      };
      saveToDisk("T2724Tc028Data", args);
      return new T2724Tc028Data(
        args.username, args.projectId, args.projectName,
        args.assignmentId, args.assignmentDate, args.taskId,
      );
    } finally {
      await db.close();
    }
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findApplyTargetNoReports } from "./queries/t2724Queries";

interface Tc016Args {
  username: string;
  projectId: number;
  projectName: string;
  assignmentId: number;
  assignmentDate: string;
  taskId: number;
  ticketInfo: string;
  tagValue: string;
}

/**
 * TC-T2724-016: Apply — assignment without reports gets closed.
 * Needs: project with PM, assignment with ticket_info, no reports on the date.
 * Tag is set to the full ticket_info value so it matches the target assignment.
 */
export class T2724Tc016Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC016_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "[done]",
    tagValue = "[done]",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignmentId = assignmentId;
    this.assignmentDate = assignmentDate;
    this.taskId = taskId;
    this.ticketInfo = ticketInfo;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc016Data> {
    if (mode === "static") return new T2724Tc016Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc016Args>("T2724Tc016Data");
      if (cached) {
        return new T2724Tc016Data(
          cached.username,
          cached.projectId,
          cached.projectName,
          cached.assignmentId,
          cached.assignmentDate,
          cached.taskId,
          cached.ticketInfo,
          cached.tagValue,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findApplyTargetNoReports(db);
      const args: Tc016Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
      };
      saveToDisk("T2724Tc016Data", args);
      return new T2724Tc016Data(
        args.username,
        args.projectId,
        args.projectName,
        args.assignmentId,
        args.assignmentDate,
        args.taskId,
        args.ticketInfo,
        args.tagValue,
      );
    } finally {
      await db.close();
    }
  }
}

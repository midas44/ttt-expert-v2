declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findGeneratedAssignmentTarget } from "./queries/t2724Queries";

interface Tc025Args {
  username: string;
  projectId: number;
  projectName: string;
  taskId: number;
  ticketInfo: string;
  tagValue: string;
  boundEmployeeId: number;
  targetDate: string;
}

/**
 * TC-T2724-025: Apply — generated (not-yet-opened) assignments also closed.
 * Finds a task+employee where no task_assignment exists on the target date.
 * After apply, verifies a new assignment was created as closed via createForCloseByTag().
 */
export class T2724Tc025Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;
  readonly boundEmployeeId: number;
  readonly targetDate: string;

  constructor(
    username = process.env.T2724_TC025_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    taskId = 0,
    ticketInfo = "DONE",
    tagValue = "DONE",
    boundEmployeeId = 0,
    targetDate = "2026-03-27",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.taskId = taskId;
    this.ticketInfo = ticketInfo;
    this.tagValue = tagValue;
    this.boundEmployeeId = boundEmployeeId;
    this.targetDate = targetDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc025Data> {
    if (mode === "static") return new T2724Tc025Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc025Args>("T2724Tc025Data");
      if (cached) {
        return new T2724Tc025Data(
          cached.username, cached.projectId, cached.projectName,
          cached.taskId, cached.ticketInfo, cached.tagValue,
          cached.boundEmployeeId, cached.targetDate,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findGeneratedAssignmentTarget(db);
      const args: Tc025Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
        boundEmployeeId: row.bound_employee_id,
        targetDate: row.target_date,
      };
      saveToDisk("T2724Tc025Data", args);
      return new T2724Tc025Data(
        args.username, args.projectId, args.projectName,
        args.taskId, args.ticketInfo, args.tagValue,
        args.boundEmployeeId, args.targetDate,
      );
    } finally {
      await db.close();
    }
  }
}

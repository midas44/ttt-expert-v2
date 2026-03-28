declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findApplyTargetWithReports } from "./queries/t2724Queries";

interface Tc017Args {
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
 * TC-T2724-017: Apply — assignment WITH reports stays visible.
 * Core safety test: assignments with reported hours must NOT be closed.
 * Tag matches the ticket_info, but hasReportOnDate() returns true → skip.
 */
export class T2724Tc017Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC017_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "[high] [done]",
    tagValue = "[high] [done]",
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
  ): Promise<T2724Tc017Data> {
    if (mode === "static") return new T2724Tc017Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc017Args>("T2724Tc017Data");
      if (cached) {
        return new T2724Tc017Data(
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
      const row = await findApplyTargetWithReports(db);
      const args: Tc017Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
      };
      if (mode === "saved") saveToDisk("T2724Tc017Data", args);
      return new T2724Tc017Data(
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

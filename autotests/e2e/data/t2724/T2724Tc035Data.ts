declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findApplyTargetWithAssignee } from "./queries/t2724Queries";

interface Tc035Args {
  username: string;
  projectId: number;
  projectName: string;
  assignmentId: number;
  assignmentDate: string;
  taskId: number;
  ticketInfo: string;
  tagValue: string;
  assigneeId: number;
}

/**
 * TC-T2724-035: Task order not disrupted after close-by-tag apply.
 * Verifies that remaining (non-closed) assignments preserve their position
 * values after close-by-tag apply + page reload. Related to #3332 and #3314.
 */
export class T2724Tc035Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;
  readonly assigneeId: number;

  constructor(
    username = process.env.T2724_TC035_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "DONE",
    tagValue = "DONE",
    assigneeId = 0,
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignmentId = assignmentId;
    this.assignmentDate = assignmentDate;
    this.taskId = taskId;
    this.ticketInfo = ticketInfo;
    this.tagValue = tagValue;
    this.assigneeId = assigneeId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc035Data> {
    if (mode === "static") return new T2724Tc035Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc035Args>("T2724Tc035Data");
      if (cached) {
        return new T2724Tc035Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignmentId, cached.assignmentDate,
          cached.taskId, cached.ticketInfo, cached.tagValue,
          cached.assigneeId,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findApplyTargetWithAssignee(db);
      const args: Tc035Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
        assigneeId: row.assignee_id,
      };
      if (mode === "saved") saveToDisk("T2724Tc035Data", args);
      return new T2724Tc035Data(
        args.username, args.projectId, args.projectName,
        args.assignmentId, args.assignmentDate,
        args.taskId, args.ticketInfo, args.tagValue,
        args.assigneeId,
      );
    } finally {
      await db.close();
    }
  }
}

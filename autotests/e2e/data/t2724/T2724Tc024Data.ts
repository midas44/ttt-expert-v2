declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findApplyTargetNoReports } from "./queries/t2724Queries";

interface Tc024Args {
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
 * TC-T2724-024: Apply from Project Members tab — triggers if tags exist.
 * Verifies that apply is triggered when PM clicks OK, regardless of which
 * dialog tab is active. Uses API-direct pattern + settings dialog accessibility check.
 */
export class T2724Tc024Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC024_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "DONE",
    tagValue = "DONE",
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
  ): Promise<T2724Tc024Data> {
    if (mode === "static") return new T2724Tc024Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc024Args>("T2724Tc024Data");
      if (cached) {
        return new T2724Tc024Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignmentId, cached.assignmentDate,
          cached.taskId, cached.ticketInfo, cached.tagValue,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findApplyTargetNoReports(db);
      const args: Tc024Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
      };
      saveToDisk("T2724Tc024Data", args);
      return new T2724Tc024Data(
        args.username, args.projectId, args.projectName,
        args.assignmentId, args.assignmentDate,
        args.taskId, args.ticketInfo, args.tagValue,
      );
    } finally {
      await db.close();
    }
  }
}

declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findApplyTargetTwoDatesNoReports } from "./queries/t2724Queries";

interface Tc021Args {
  username: string;
  projectId: number;
  projectName: string;
  assignment1Id: number;
  assignment1Date: string;
  assignment2Id: number;
  assignment2Date: string;
  taskId: number;
  ticketInfo: string;
  tagValue: string;
}

/**
 * TC-T2724-021: Apply on specific date — only affects selected date.
 * Two assignments on different dates for the same task+assignee, both without reports.
 * Apply on date1 should close only date1, leaving date2 unaffected.
 */
export class T2724Tc021Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignment1Id: number;
  readonly assignment1Date: string;
  readonly assignment2Id: number;
  readonly assignment2Date: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC021_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignment1Id = 0,
    assignment1Date = "2026-03-27",
    assignment2Id = 0,
    assignment2Date = "2026-03-28",
    taskId = 0,
    ticketInfo = "DONE",
    tagValue = "DONE",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignment1Id = assignment1Id;
    this.assignment1Date = assignment1Date;
    this.assignment2Id = assignment2Id;
    this.assignment2Date = assignment2Date;
    this.taskId = taskId;
    this.ticketInfo = ticketInfo;
    this.tagValue = tagValue;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc021Data> {
    if (mode === "static") return new T2724Tc021Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc021Args>("T2724Tc021Data");
      if (cached) {
        return new T2724Tc021Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignment1Id, cached.assignment1Date,
          cached.assignment2Id, cached.assignment2Date,
          cached.taskId, cached.ticketInfo, cached.tagValue,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findApplyTargetTwoDatesNoReports(db);
      const args: Tc021Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignment1Id: row.assignment1_id,
        assignment1Date: row.assignment1_date,
        assignment2Id: row.assignment2_id,
        assignment2Date: row.assignment2_date,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
      };
      saveToDisk("T2724Tc021Data", args);
      return new T2724Tc021Data(
        args.username, args.projectId, args.projectName,
        args.assignment1Id, args.assignment1Date,
        args.assignment2Id, args.assignment2Date,
        args.taskId, args.ticketInfo, args.tagValue,
      );
    } finally {
      await db.close();
    }
  }
}

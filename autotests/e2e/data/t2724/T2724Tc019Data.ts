declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findApplyTargetNoReports } from "./queries/t2724Queries";

interface Tc019Args {
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
 * TC-T2724-019: Apply — substring matching.
 * Creates a tag that's a substring of ticket_info to verify containsIgnoreCase.
 * E.g., ticket_info "[high] [done]" → tag "done" (substring match).
 */
export class T2724Tc019Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC019_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "[high] [done]",
    tagValue = "done",
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
  ): Promise<T2724Tc019Data> {
    if (mode === "static") return new T2724Tc019Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc019Args>("T2724Tc019Data");
      if (cached) {
        return new T2724Tc019Data(
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
      // Extract a substring from ticket_info (use the last word or a bracketed segment)
      const info = row.ticket_info;
      const bracketMatch = info.match(/\[([^\]]+)\]/);
      const tagValue = bracketMatch
        ? bracketMatch[1] // inner text of a [bracket] segment
        : info.split(/\s+/).pop() ?? info; // last word

      const args: Tc019Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: info,
        tagValue,
      };
      if (mode === "saved") saveToDisk("T2724Tc019Data", args);
      return new T2724Tc019Data(
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

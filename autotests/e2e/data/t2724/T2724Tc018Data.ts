declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findApplyTargetNoReports } from "./queries/t2724Queries";

interface Tc018Args {
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
 * TC-T2724-018: Apply — case-insensitive matching.
 * Creates a tag in opposite case from ticket_info and verifies it still matches.
 * E.g., ticket_info "Resolved" → tag "resolved" (lowercase).
 */
export class T2724Tc018Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC018_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "Resolved",
    tagValue = "resolved",
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
  ): Promise<T2724Tc018Data> {
    if (mode === "static") return new T2724Tc018Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc018Args>("T2724Tc018Data");
      if (cached) {
        return new T2724Tc018Data(
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
      // Derive tag in opposite case to prove case-insensitivity
      const info = row.ticket_info;
      const isUpperDominant =
        info.replace(/[^A-Z]/g, "").length >=
        info.replace(/[^a-z]/g, "").length;
      const tagValue = isUpperDominant ? info.toLowerCase() : info.toUpperCase();

      const args: Tc018Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: info,
        tagValue,
      };
      saveToDisk("T2724Tc018Data", args);
      return new T2724Tc018Data(
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

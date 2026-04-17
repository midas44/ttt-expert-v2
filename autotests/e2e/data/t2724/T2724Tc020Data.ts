declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findApplyTargetNoReports } from "./queries/t2724Queries";

interface Tc020Args {
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
 * TC-T2724-020: Apply — false positive matching.
 * Demonstrates that short tags cause unintended matches via substring containment.
 * E.g., ticket_info "Resolved" → tag "solve" (matches because "Resolved" contains "solve").
 * This is a known, stakeholder-accepted behavior.
 */
export class T2724Tc020Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;

  constructor(
    username = process.env.T2724_TC020_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    taskId = 0,
    ticketInfo = "Resolved",
    tagValue = "solve",
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
  ): Promise<T2724Tc020Data> {
    if (mode === "static") return new T2724Tc020Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc020Args>("T2724Tc020Data");
      if (cached) {
        return new T2724Tc020Data(
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
      // Extract a false-positive substring: take middle characters from ticket_info
      // E.g., "Resolved" → "solve", "[done]" → "one", "[in progress]" → "progress"
      const info = row.ticket_info;
      let tagValue: string;

      // Try to find a mid-word substring that would be a false positive
      const cleaned = info.replace(/[\[\]]/g, "").trim();
      const words = cleaned.split(/\s+/);
      if (words.length > 0 && words[0].length >= 4) {
        // Take the last N-1 chars of the first word (e.g., "Resolved" → "solved")
        tagValue = words[0].substring(1).toLowerCase();
      } else {
        // Fallback: take the shortest word as the false-positive trigger
        const sorted = words.filter((w) => w.length >= 2).sort((a, b) => a.length - b.length);
        tagValue = sorted.length > 0 ? sorted[0].toLowerCase() : info.toLowerCase();
      }

      const args: Tc020Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        assignmentId: row.assignment_id,
        assignmentDate: row.assignment_date,
        taskId: row.task_id,
        ticketInfo: info,
        tagValue,
      };
      saveToDisk("T2724Tc020Data", args);
      return new T2724Tc020Data(
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

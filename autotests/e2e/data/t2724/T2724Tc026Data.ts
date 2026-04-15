declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findNewAssignmentSlot } from "./queries/t2724Queries";

interface Tc026Args {
  username: string;
  projectId: number;
  projectName: string;
  taskId: number;
  ticketInfo: string;
  tagValue: string;
  employeeId: number;
  targetDate: string;
}

/**
 * TC-T2724-026: Apply after 'Open for editing' — newly generated assignments eligible.
 * Finds a task+bound employee with no assignment on a recent date.
 * The test will INSERT an assignment (simulating "open for editing"),
 * then apply close-by-tag and verify the new assignment gets closed.
 */
export class T2724Tc026Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly taskId: number;
  readonly ticketInfo: string;
  readonly tagValue: string;
  readonly employeeId: number;
  readonly targetDate: string;

  constructor(
    username = process.env.T2724_TC026_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    taskId = 0,
    ticketInfo = "DONE",
    tagValue = "DONE",
    employeeId = 0,
    targetDate = "2026-03-26",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.taskId = taskId;
    this.ticketInfo = ticketInfo;
    this.tagValue = tagValue;
    this.employeeId = employeeId;
    this.targetDate = targetDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc026Data> {
    if (mode === "static") return new T2724Tc026Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc026Args>("T2724Tc026Data");
      if (cached) {
        return new T2724Tc026Data(
          cached.username, cached.projectId, cached.projectName,
          cached.taskId, cached.ticketInfo, cached.tagValue,
          cached.employeeId, cached.targetDate,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findNewAssignmentSlot(db);
      const args: Tc026Args = {
        username: row.manager_login,
        projectId: row.project_id,
        projectName: row.project_name,
        taskId: row.task_id,
        ticketInfo: row.ticket_info,
        tagValue: row.ticket_info,
        employeeId: row.employee_id,
        targetDate: row.target_date,
      };
      saveToDisk("T2724Tc026Data", args);
      return new T2724Tc026Data(
        args.username, args.projectId, args.projectName,
        args.taskId, args.ticketInfo, args.tagValue,
        args.employeeId, args.targetDate,
      );
    } finally {
      await db.close();
    }
  }
}

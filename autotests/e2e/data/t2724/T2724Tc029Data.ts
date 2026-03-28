declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findApplyTargetNoReports,
  findProjectWithNoTags,
} from "./queries/t2724Queries";

interface Tc029Args {
  username: string;
  projectId: number;
  projectName: string;
  assignmentId: number;
  assignmentDate: string;
  ticketInfo: string;
  tagValue: string;
  noTagsProjectId: number;
  noTagsProjectName: string;
}

/**
 * TC-T2724-029: Apply endpoint — API direct call.
 * Tests the apply endpoint directly:
 *   1. POST with {date} → 200, assignment closed
 *   2. POST with empty body → 200 (no-op, null date guard)
 *   3. POST for project with no tags → 200 (no-op)
 */
export class T2724Tc029Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignmentId: number;
  readonly assignmentDate: string;
  readonly ticketInfo: string;
  readonly tagValue: string;
  readonly noTagsProjectId: number;
  readonly noTagsProjectName: string;

  constructor(
    username = process.env.T2724_TC029_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignmentId = 0,
    assignmentDate = "2026-03-27",
    ticketInfo = "DONE",
    tagValue = "DONE",
    noTagsProjectId = 999,
    noTagsProjectName = "NoTagsProject",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignmentId = assignmentId;
    this.assignmentDate = assignmentDate;
    this.ticketInfo = ticketInfo;
    this.tagValue = tagValue;
    this.noTagsProjectId = noTagsProjectId;
    this.noTagsProjectName = noTagsProjectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc029Data> {
    if (mode === "static") return new T2724Tc029Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc029Args>("T2724Tc029Data");
      if (cached) {
        return new T2724Tc029Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignmentId, cached.assignmentDate,
          cached.ticketInfo, cached.tagValue,
          cached.noTagsProjectId, cached.noTagsProjectName,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const target = await findApplyTargetNoReports(db);
      const noTags = await findProjectWithNoTags(db);
      const args: Tc029Args = {
        username: target.manager_login,
        projectId: target.project_id,
        projectName: target.project_name,
        assignmentId: target.assignment_id,
        assignmentDate: target.assignment_date,
        ticketInfo: target.ticket_info,
        tagValue: target.ticket_info,
        noTagsProjectId: noTags.project_id,
        noTagsProjectName: noTags.project_name,
      };
      if (mode === "saved") saveToDisk("T2724Tc029Data", args);
      return new T2724Tc029Data(
        args.username, args.projectId, args.projectName,
        args.assignmentId, args.assignmentDate,
        args.ticketInfo, args.tagValue,
        args.noTagsProjectId, args.noTagsProjectName,
      );
    } finally {
      await db.close();
    }
  }
}

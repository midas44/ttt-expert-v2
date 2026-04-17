declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findApplyTargetNoReports,
  findSecondClosableAssignment,
} from "./queries/t2724Queries";

interface Tc027Args {
  username: string;
  projectId: number;
  projectName: string;
  assignment1Id: number;
  assignment1Date: string;
  ticketInfo1: string;
  assignment2Id: number;
  assignment2Date: string;
  ticketInfo2: string;
}

/**
 * TC-T2724-027: Apply — multiple tags, partial matches.
 * Finds a project with 2 unclosed assignments having different ticket_info values
 * (both without reports). Creates tags matching each, applies, verifies both closed.
 * Tests OR logic: assignment matching ANY tag is eligible for closing.
 */
export class T2724Tc027Data {
  readonly username: string;
  readonly projectId: number;
  readonly projectName: string;
  readonly assignment1Id: number;
  readonly assignment1Date: string;
  readonly ticketInfo1: string;
  readonly assignment2Id: number;
  readonly assignment2Date: string;
  readonly ticketInfo2: string;

  constructor(
    username = process.env.T2724_TC027_USER ?? "dergachev",
    projectId = 1016,
    projectName = "Diabolocom-Java-ODC",
    assignment1Id = 0,
    assignment1Date = "2026-03-27",
    ticketInfo1 = "[done]",
    assignment2Id = 0,
    assignment2Date = "2026-03-27",
    ticketInfo2 = "[closed]",
  ) {
    this.username = username;
    this.projectId = projectId;
    this.projectName = projectName;
    this.assignment1Id = assignment1Id;
    this.assignment1Date = assignment1Date;
    this.ticketInfo1 = ticketInfo1;
    this.assignment2Id = assignment2Id;
    this.assignment2Date = assignment2Date;
    this.ticketInfo2 = ticketInfo2;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T2724Tc027Data> {
    if (mode === "static") return new T2724Tc027Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc027Args>("T2724Tc027Data");
      if (cached) {
        return new T2724Tc027Data(
          cached.username, cached.projectId, cached.projectName,
          cached.assignment1Id, cached.assignment1Date, cached.ticketInfo1,
          cached.assignment2Id, cached.assignment2Date, cached.ticketInfo2,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // Two-step: find first closable assignment, then a second with different ticket_info
      const first = await findApplyTargetNoReports(db);
      const second = await findSecondClosableAssignment(
        db, first.project_id, first.ticket_info,
      );
      const args: Tc027Args = {
        username: first.manager_login,
        projectId: first.project_id,
        projectName: first.project_name,
        assignment1Id: first.assignment_id,
        assignment1Date: first.assignment_date,
        ticketInfo1: first.ticket_info,
        assignment2Id: second.assignment_id,
        assignment2Date: second.assignment_date,
        ticketInfo2: second.ticket_info,
      };
      saveToDisk("T2724Tc027Data", args);
      return new T2724Tc027Data(
        args.username, args.projectId, args.projectName,
        args.assignment1Id, args.assignment1Date, args.ticketInfo1,
        args.assignment2Id, args.assignment2Date, args.ticketInfo2,
      );
    } finally {
      await db.close();
    }
  }
}

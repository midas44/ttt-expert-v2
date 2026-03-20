declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithProject } from "./queries/reportQueries";
import { formatTimestamp, formatDateColumn } from "../utils/stringUtils";

export class ReportTc1Data {
  readonly username: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly reportValue: string;
  readonly searchTerm: string;
  readonly rowPattern: RegExp;
  readonly dateLabel: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportTc1Data> {
    if (mode === "static") return new ReportTc1Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const db = new DbClient(tttConfig);
    try {
      const { login, projectName } = await findEmployeeWithProject(db);
      const reportValue = ReportTc1Data.randomReportValue();
      return new ReportTc1Data(login, projectName, "autotest", reportValue);
    } finally {
      await db.close();
    }
  }

  /** Generates a random report value from 0.25 to 8.00 in 0.25 increments. */
  private static randomReportValue(): string {
    const steps = Math.floor(Math.random() * 32) + 1; // 1..32
    return (steps * 0.25).toFixed(2);
  }

  constructor(
    /** @env REPORT_TC1_USERNAME — Employee who can manage personal task reports */
    username = process.env.REPORT_TC1_USERNAME ?? "vulyanov",
    /** @env REPORT_TC1_PROJECT — Project name prefix for the search term */
    projectName = process.env.REPORT_TC1_PROJECT ?? "HR",
    /** @env REPORT_TC1_TASK — Task name component for the search term */
    taskName = process.env.REPORT_TC1_TASK ?? "autotest",
    /** @env REPORT_TC1_REPORT_VALUE — Numeric value to enter in the report cell */
    reportValue = process.env.REPORT_TC1_REPORT_VALUE ?? "4.25",
  ) {
    this.username = username;
    this.projectName = projectName;
    this.taskName = taskName;
    this.reportValue = reportValue;

    const timestamp = formatTimestamp();
    this.searchTerm = `${projectName} / ${taskName} ${timestamp}`;
    this.rowPattern = new RegExp(`${taskName}\\s+${timestamp}`);
    this.dateLabel = formatDateColumn();
  }
}

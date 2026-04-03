import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";

/**
 * Creates/deletes/rejects time reports via API for test setup and cleanup.
 *
 * Uses API_SECRET_TOKEN which can create reports for any employee
 * (cross-employee reporting, BUG-REPORT-4).
 *
 * Usage:
 *   const setup = new ApiReportSetupFixture(request, tttConfig);
 *   const report = await setup.createReport("employee_login", taskId, 480, "2026-04-03");
 *   // ... UI test on confirmation page ...
 *   await setup.deleteReport(report.id);
 */
export class ApiReportSetupFixture {
  private readonly reportsUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly request: APIRequestContext,
    private readonly tttConfig: TttConfig,
  ) {
    this.reportsUrl = tttConfig.buildUrl("/api/ttt/v1/reports");
    this.headers = {
      API_SECRET_TOKEN: tttConfig.apiToken,
      "Content-Type": "application/json",
    };
  }

  /**
   * Creates a time report for the given employee via API.
   * @param executorLogin - employee to create the report for
   * @param taskId - task ID
   * @param effort - effort in minutes (e.g. 480 = 8h)
   * @param reportDate - ISO date string (YYYY-MM-DD)
   * @returns created report with id and state
   */
  async createReport(
    executorLogin: string,
    taskId: number,
    effort: number,
    reportDate: string,
  ): Promise<ReportApiResult> {
    const resp = await this.request.post(this.reportsUrl, {
      headers: this.headers,
      data: {
        taskId,
        reportDate,
        executorLogin,
        effort,
      },
    });

    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(
        `Failed to create report for ${executorLogin}: ${resp.status()} ${body}`,
      );
    }

    const json = await resp.json();
    return {
      id: json.id,
      state: json.state,
      executorLogin,
      taskId,
      effort,
      reportDate,
    };
  }

  /**
   * Changes a report's state via PATCH (approve or reject).
   * Requires REPORTS_APPROVE permission (token owner pvaynmaster is ADMIN).
   */
  async patchReportState(
    reportId: number,
    state: "APPROVED" | "REJECTED",
    stateComment?: string,
  ): Promise<void> {
    const url = `${this.reportsUrl}/${reportId}`;
    const data: Record<string, unknown> = { state };
    if (stateComment) data.stateComment = stateComment;

    const resp = await this.request.patch(url, {
      headers: this.headers,
      data,
    });

    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(
        `Failed to patch report ${reportId} to ${state}: ${resp.status()} ${body}`,
      );
    }
  }

  /**
   * Deletes a report by setting effort to 0 (the app auto-deletes on effort=0).
   * Accepts 200 and ignores 404 (already deleted).
   */
  async deleteReport(reportId: number): Promise<void> {
    const url = `${this.reportsUrl}/${reportId}`;
    const resp = await this.request.patch(url, {
      headers: this.headers,
      data: { effort: 0 },
    });

    if (!resp.ok() && resp.status() !== 404) {
      const body = await resp.text();
      throw new Error(
        `Failed to delete report ${reportId}: ${resp.status()} ${body}`,
      );
    }
  }

  /** Create a report then immediately reject it. Returns the report info. */
  async createAndReject(
    executorLogin: string,
    taskId: number,
    effort: number,
    reportDate: string,
    comment = "Test rejection",
  ): Promise<ReportApiResult> {
    const report = await this.createReport(
      executorLogin,
      taskId,
      effort,
      reportDate,
    );
    await this.patchReportState(report.id, "REJECTED", comment);
    return { ...report, state: "REJECTED" };
  }
}

export interface ReportApiResult {
  id: number;
  state: string;
  executorLogin: string;
  taskId: number;
  effort: number;
  reportDate: string;
}

declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-130: Vacation list with filters — type, status, date range.
 *
 * API test: GET /api/vacation/v2/availability-schedule with various filters.
 * Read-only test — no vacation creation needed.
 */
export class VacationTc130Data {
  readonly login: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly scheduleEndpoint = "/api/vacation/v2/availability-schedule";
  readonly typeFilters = ["MY", "ALL", "APPROVER"] as const;

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc130Data> {
    return new VacationTc130Data();
  }

  constructor(
    login = process.env.VACATION_TC130_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
  }

  buildFilterUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    // Always include pagination to avoid NPE (TC-VAC-118)
    url.searchParams.set("page", params.page ?? "0");
    url.searchParams.set("pageSize", params.pageSize ?? "20");
    // v2 availability-schedule requires from/to — NPE without them
    if (!params.from) url.searchParams.set("from", "2025-01-01");
    if (!params.to) url.searchParams.set("to", "2026-12-31");
    for (const [key, value] of Object.entries(params)) {
      if (key !== "page" && key !== "pageSize") {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }
}

import type { Page } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";

/**
 * Creates and cleans up sick leaves via API using the browser's session cookies.
 *
 * Sick leave CRUD requires AUTHENTICATED_USER authority — API tokens get 403.
 * Uses page.evaluate(fetch) to make API calls from within the browser context,
 * inheriting the CAS SSO session cookie set by LoginFixture.
 *
 * Usage in test:
 *   await login.run(); // browser login sets session cookie
 *   const setup = new ApiSickLeaveSetupFixture(page, tttConfig);
 *   const sl = await setup.createSickLeave(login, startDate, endDate);
 *   // ... UI test ...
 *   await setup.deleteSickLeave(sl.id);
 */
export class ApiSickLeaveSetupFixture {
  private readonly baseUrl: string;

  constructor(
    private readonly page: Page,
    private readonly tttConfig: TttConfig,
  ) {
    this.baseUrl = tttConfig.buildUrl("/api/vacation/v1/sick-leaves");
  }

  /** Creates a sick leave via API. Returns the created entity. */
  async createSickLeave(
    login: string,
    startDate: string,
    endDate: string,
    opts: { number?: string; force?: boolean } = {},
  ): Promise<SickLeaveApiResult> {
    const body = {
      login,
      startDate,
      endDate,
      force: opts.force ?? false,
      number: opts.number ?? null,
      notifyAlso: [],
      filesIds: [],
    };

    const result = await this.fetchFromBrowser("POST", this.baseUrl, body);
    if (result.status >= 400) {
      throw new Error(
        `Failed to create sick leave for ${login}: ${result.status} ${JSON.stringify(result.body)}`,
      );
    }

    const json = result.body;
    return {
      id: json.id,
      status: json.status,
      accountingStatus: json.accountingStatus,
      login,
      startDate,
      endDate,
    };
  }

  /** Patches a sick leave (e.g., to close it or change accounting status). */
  async patchSickLeave(
    sickLeaveId: number,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.baseUrl}/${sickLeaveId}`;
    const result = await this.fetchFromBrowser("PATCH", url, patch);
    if (result.status >= 400) {
      throw new Error(
        `Failed to patch sick leave ${sickLeaveId}: ${result.status} ${JSON.stringify(result.body)}`,
      );
    }
  }

  /** Deletes a sick leave via API (soft delete — sets status=DELETED). */
  async deleteSickLeave(sickLeaveId: number): Promise<void> {
    const url = `${this.baseUrl}/${sickLeaveId}`;
    const result = await this.fetchFromBrowser("DELETE", url);
    // Accept success or 400 (already deleted / PAID)
    if (result.status >= 400 && result.status !== 400) {
      throw new Error(
        `Failed to delete sick leave ${sickLeaveId}: ${result.status} ${JSON.stringify(result.body)}`,
      );
    }
  }

  /**
   * Makes an API call from within the browser context using fetch(),
   * which inherits the CAS SSO session cookies.
   */
  private async fetchFromBrowser(
    method: string,
    url: string,
    data?: unknown,
  ): Promise<{ status: number; body: any }> {
    return this.page.evaluate(
      async ([m, u, d]) => {
        const opts: RequestInit = {
          method: m,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        };
        if (d !== undefined) {
          opts.body = JSON.stringify(d);
        }
        const resp = await fetch(u, opts);
        const text = await resp.text();
        let body: any;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        return { status: resp.status, body };
      },
      [method, url, data] as const,
    );
  }
}

export interface SickLeaveApiResult {
  id: number;
  status: string;
  accountingStatus: string;
  login: string;
  startDate: string;
  endDate: string;
}

import type { APIRequestContext } from "@playwright/test";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "../data/queries/vacationQueries";

/**
 * Creates vacation precondition states via API for tests that need specific
 * vacation statuses (APPROVED, CANCELED, etc.) before the UI test begins.
 *
 * Uses API_SECRET_TOKEN which authenticates as the token owner (pvaynmaster).
 * For creating vacations as other employees, use JWT auth via getJwtForUser().
 *
 * Usage in test:
 *   const setup = new ApiVacationSetupFixture(request, tttConfig);
 *   const vacation = await setup.createAndApprove(employeeLogin, startDate, endDate);
 *   // ... UI test operates on this vacation ...
 *   await setup.deleteVacation(vacation.id); // cleanup
 */
export class ApiVacationSetupFixture {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly request: APIRequestContext,
    private readonly tttConfig: TttConfig,
  ) {
    this.baseUrl = tttConfig.buildUrl("/api/vacation/v1/vacations");
    this.headers = {
      API_SECRET_TOKEN: tttConfig.apiToken,
      "Content-Type": "application/json",
    };
  }

  /**
   * The login of the API_SECRET_TOKEN owner. All API vacation operations
   * are performed as this user because @CurrentUser requires login == authenticated user,
   * and there is no endpoint to get a JWT for arbitrary users.
   */
  readonly tokenOwner = "pvaynmaster";

  /** Create a vacation via API as the token owner. Returns the created vacation object. */
  async createVacation(
    startDate: string,
    endDate: string,
    paymentType = "REGULAR",
  ): Promise<VacationApiResult> {
    const login = this.tokenOwner;
    const paymentMonth = `${startDate.slice(0, 8)}01`; // first of the month
    const resp = await this.request.post(this.baseUrl, {
      headers: this.headers,
      data: {
        login,
        startDate,
        endDate,
        paymentType,
        paymentMonth,
        optionalApprovers: [],
        notifyAlso: [],
      },
    });

    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(
        `Failed to create vacation for ${login}: ${resp.status()} ${body}`,
      );
    }

    const json = await resp.json();
    const vacation = json.vacation ?? json;
    return {
      id: vacation.id,
      status: vacation.status,
      login: this.tokenOwner,
      startDate,
      endDate,
    };
  }

  /** Approve a vacation via API. Uses API_SECRET_TOKEN (pvaynmaster is CPO, self-approves). */
  async approveVacation(vacationId: number): Promise<void> {
    const url = `${this.baseUrl}/${vacationId}/approve`;
    const resp = await this.request.post(url, { headers: this.headers });
    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(
        `Failed to approve vacation ${vacationId}: ${resp.status()} ${body}`,
      );
    }
  }

  /** Cancel a vacation via API. Uses API_SECRET_TOKEN (owner cancels own vacation). */
  async cancelVacation(vacationId: number): Promise<void> {
    const url = `${this.baseUrl}/${vacationId}/cancel`;
    const resp = await this.request.put(url, { headers: this.headers });
    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(
        `Failed to cancel vacation ${vacationId}: ${resp.status()} ${body}`,
      );
    }
  }

  /** Delete (soft) a vacation via API. Used for cleanup. */
  async deleteVacation(vacationId: number): Promise<void> {
    const url = `${this.baseUrl}/${vacationId}`;
    const resp = await this.request.delete(url, { headers: this.headers });
    // Accept 200 or 404 (already deleted)
    if (!resp.ok() && resp.status() !== 404) {
      const body = await resp.text();
      throw new Error(
        `Failed to delete vacation ${vacationId}: ${resp.status()} ${body}`,
      );
    }
  }

  /** Create → Approve a vacation as token owner. Returns the approved vacation. */
  async createAndApprove(
    startDate: string,
    endDate: string,
    paymentType = "REGULAR",
  ): Promise<VacationApiResult> {
    const vacation = await this.createVacation(startDate, endDate, paymentType);
    await this.approveVacation(vacation.id);
    return { ...vacation, status: "APPROVED" };
  }

  /** Create → Cancel a vacation as token owner. Returns the canceled vacation. */
  async createAndCancel(
    startDate: string,
    endDate: string,
    paymentType = "REGULAR",
  ): Promise<VacationApiResult> {
    const vacation = await this.createVacation(startDate, endDate, paymentType);
    await this.cancelVacation(vacation.id);
    return { ...vacation, status: "CANCELED" };
  }

  /**
   * Find a conflict-free 5-day (Mon-Fri) window for an employee.
   * Returns ISO dates (YYYY-MM-DD format).
   */
  static async findAvailableWeek(
    tttConfig: TttConfig,
    login: string,
    weeksAhead = 2,
    maxAttempts = 20,
  ): Promise<{ startDate: string; endDate: string }> {
    const db = new DbClient(tttConfig);
    try {
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      const base = new Date(now);
      base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

      for (let i = 0; i < maxAttempts; i++) {
        const start = new Date(base);
        start.setDate(base.getDate() + i * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4); // Friday

        const startIso = toIso(start);
        const endIso = toIso(end);

        if (!(await hasVacationConflict(db, login, startIso, endIso))) {
          return { startDate: startIso, endDate: endIso };
        }
      }
      throw new Error(
        `No conflict-free week found for ${login} within ${maxAttempts} weeks`,
      );
    } finally {
      await db.close();
    }
  }
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface VacationApiResult {
  id: number;
  status: string;
  login: string;
  startDate: string;
  endDate: string;
}

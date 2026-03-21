declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-004: Create vacation with start date in past — negative test
 *
 * Preconditions:
 * - Active employee
 * - startDate = yesterday (in the past)
 * Expected: HTTP 400, errorCode: validation.vacation.start.date.in.past
 */
export class VacationTc004Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly expectedErrorCode: string;
  readonly expectedHttpStatus: number;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc004Data> {
    if (mode === "static") return new VacationTc004Data();
    if (mode === "saved") {
      const cached = loadSaved<{ login: string }>("VacationTc004Data");
      if (cached) return new VacationTc004Data(cached.login);
    }

    // @CurrentUser DTO validation requires login == token's authenticated user.
    // API_SECRET_TOKEN authenticates as a fixed user (pvaynmaster on qa-1).
    // For negative tests, the login just needs to pass @CurrentUser; date validation is the focus.
    const login = process.env.VACATION_TC004_LOGIN ?? "pvaynmaster";
    const instance = new VacationTc004Data(login);
    if (mode === "saved") saveToDisk("VacationTc004Data", { login });
    return instance;
  }

  constructor(
    login = process.env.VACATION_TC004_LOGIN ?? "slebedev",
  ) {
    this.login = login;

    // Dates computed dynamically: yesterday as start, tomorrow as end
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    this.startDate = toIso(yesterday);
    this.endDate = toIso(tomorrow);
    this.paymentType = "REGULAR";
    this.paymentMonth = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-01`;
    this.expectedErrorCode = "validation.vacation.start.date.in.past";
    this.expectedHttpStatus = 400;
    this.authHeaderName = "API_SECRET_TOKEN";
    this.vacationEndpoint = "/api/vacation/v1/vacations";
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

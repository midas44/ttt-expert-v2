declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-005: Create vacation with startDate > endDate — negative test
 *
 * Preconditions:
 * - Active employee
 * - startDate later than endDate (reversed dates)
 * Expected: HTTP 400, errorCode: validation.vacation.dates.order
 */
export class VacationTc005Data {
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
  ): Promise<VacationTc005Data> {
    if (mode === "static") return new VacationTc005Data();
    if (mode === "saved") {
      const cached = loadSaved<{ login: string }>("VacationTc005Data");
      if (cached) return new VacationTc005Data(cached.login);
    }

    // @CurrentUser requires login == token's authenticated user (pvaynmaster on qa-1).
    const login = process.env.VACATION_TC005_LOGIN ?? "pvaynmaster";
    const instance = new VacationTc005Data(login);
    if (mode === "saved") saveToDisk("VacationTc005Data", { login });
    return instance;
  }

  constructor(
    login = process.env.VACATION_TC005_LOGIN ?? "slebedev",
  ) {
    this.login = login;

    // Reversed dates: startDate is 5 days AFTER endDate
    const now = new Date();
    const futureEnd = new Date(now);
    futureEnd.setDate(now.getDate() + 21);
    const futureStart = new Date(futureEnd);
    futureStart.setDate(futureEnd.getDate() + 5);

    this.startDate = toIso(futureStart); // later date
    this.endDate = toIso(futureEnd);     // earlier date
    this.paymentType = "REGULAR";
    this.paymentMonth = `${futureEnd.getFullYear()}-${String(futureEnd.getMonth() + 1).padStart(2, "0")}-01`;
    this.expectedErrorCode = "validation.vacation.dates.order";
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

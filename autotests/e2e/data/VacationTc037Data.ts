declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-037: Update vacation — approver edits (EDIT_APPROVER permission).
 *
 * Creates a vacation (pvaynmaster = owner AND approver as DM self-approver),
 * then updates dates and comment to verify EDIT_APPROVER permission allows edit
 * while status is not CANCELED/PAID.
 *
 * Vault ref: modules/vacation-service-deep-dive § Permission Calculation
 * EDIT_APPROVER granted when: isApprover && !NON_EDITABLE_STATUSES
 */
export class VacationTc037Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly updatedStartDate: string;
  readonly updatedEndDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly updatedPaymentMonth: string;
  readonly comment = "";
  readonly updatedComment = "Updated by approver — TC-037 test";
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly approveEndpoint = "/api/vacation/v1/vacations/approve";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc037Data> {
    if (mode === "static") return new VacationTc037Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const original = await VacationTc037Data.findAvailableWeek(db, login, 269);
      const updated = await VacationTc037Data.findAvailableWeek(db, login, 272);
      return new VacationTc037Data(
        login,
        original.startDate, original.endDate,
        updated.startDate, updated.endDate,
      );
    } finally {
      await db.close();
    }
  }

  private static async findAvailableWeek(
    db: DbClient,
    login: string,
    startWeekOffset: number,
  ): Promise<{ startDate: string; endDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 24; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return { startDate: startIso, endDate: endIso };
      }
    }
    throw new Error(
      `No conflict-free week for "${login}" from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC037_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC037_START ?? "2031-05-12",
    endDate = process.env.VACATION_TC037_END ?? "2031-05-16",
    updatedStartDate = process.env.VACATION_TC037_UPD_START ?? "2031-05-26",
    updatedEndDate = process.env.VACATION_TC037_UPD_END ?? "2031-05-30",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.updatedStartDate = updatedStartDate;
    this.updatedEndDate = updatedEndDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.updatedPaymentMonth = updatedStartDate.slice(0, 7) + "-01";
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      comment: this.comment,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  buildUpdateBody(vacationId: number): Record<string, unknown> {
    return {
      id: vacationId,
      login: this.login,
      startDate: this.updatedStartDate,
      endDate: this.updatedEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.updatedPaymentMonth,
      comment: this.updatedComment,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

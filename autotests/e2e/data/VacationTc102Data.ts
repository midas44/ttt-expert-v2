declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-102: Timeline audit gaps for payment events.
 *
 * Read-only DB test: finds an existing PAID vacation and verifies that
 * the VACATION_PAID timeline event has incomplete audit data (days_used=0,
 * administrative_days_used=0, previous_status=NULL).
 *
 * Vault ref: exploration/api-findings/payment-flow-live-testing § Timeline audit gaps,
 *            exploration/data-findings/vacation-schema-deep-dive § timeline
 */
export class VacationTc102Data {
  readonly login: string;
  readonly authHeaderName = "API_SECRET_TOKEN";

  /** SQL to find a PAID vacation with timeline events. */
  readonly findPaidVacationSql = `
    SELECT v.id AS vacation_id, v.start_date, v.end_date, v.regular_days,
           v.administrative_days, v.status, ve.login
    FROM ttt_vacation.vacation v
    JOIN ttt_vacation.employee ve ON ve.id = v.employee
    WHERE v.status = 'PAID'
    ORDER BY v.id DESC
    LIMIT 1`;

  /** SQL to find timeline events for a specific vacation. */
  readonly timelineEventsSql = `
    SELECT t.id, t.event_type, t.days_used, t.administrative_days_used,
           t.previous_status, t.description, t.event_time
    FROM ttt_vacation.timeline t
    WHERE t.vacation = $1
    ORDER BY t.event_time`;

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc102Data> {
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');
    return new VacationTc102Data();
  }

  constructor(
    login = process.env.VACATION_TC102_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
  }
}

declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PaidVacationRow {
  login: string;
  start_date: string;
  end_date: string;
}

/**
 * TC-VAC-026: Cannot cancel PAID vacation.
 * Finds an existing PAID vacation and its owner.
 */
export class VacationTc026Data {
  readonly username: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc026Data> {
    if (mode === "static") return new VacationTc026Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<PaidVacationRow>(
        `SELECT e.login, v.start_date::text, v.end_date::text
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status = 'PAID'
           AND e.enabled = true
         ORDER BY v.start_date DESC
         LIMIT 1`,
      );
      return new VacationTc026Data(row.login, row.start_date, row.end_date);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC026_USERNAME ?? "amelnikova",
    startDate = "2026-01-12",
    endDate = "2026-01-16",
  ) {
    this.username = username;
    this.periodPattern = VacationTc026Data.buildPatternFromIso(
      startDate,
      endDate,
    );
  }

  static buildPatternFromIso(startIso: string, endIso: string): RegExp {
    const [sY, sM, sD] = startIso.split("-").map(Number);
    const [eY, eM, eD] = endIso.split("-").map(Number);
    const sMonth = sM - 1;
    const eMonth = eM - 1;
    const sDD = String(sD).padStart(2, "0");
    const sMM = String(sM).padStart(2, "0");
    const eDD = String(eD).padStart(2, "0");
    const eMM = String(eM).padStart(2, "0");

    const alternatives = [
      `0?${sD}\\s*[–\\-]\\s*0?${eD}\\s+${MONTH_ABBREVS[eMonth]}\\w*\\s+${eY}`,
      `${sDD}\\.${sMM}\\.${sY}.*${eDD}\\.${eMM}\\.${eY}`,
      `${MONTH_NAMES[sMonth]}\\s+${sD}.*${MONTH_NAMES[eMonth]}\\s+${eD}`,
      `0?${sD}\\s+${MONTH_ABBREVS[sMonth]}.*0?${eD}\\s+${MONTH_ABBREVS[eMonth]}`,
    ];
    return new RegExp(alternatives.join("|"));
  }
}

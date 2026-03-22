declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findRandomEmployee } from "./queries/vacationQueries";

/**
 * TC-VAC-016: Verify "Number of days" auto-calculation in dialog.
 * Read-only — just needs any enabled employee to open the create dialog.
 * Computes Mon-Fri and Sat-Sun date ranges for verification.
 */
export class VacationTc016Data {
  readonly username: string;
  /** Monday date in dd.mm.yyyy format */
  readonly mondayDate: string;
  /** Friday of the same week in dd.mm.yyyy format */
  readonly fridayDate: string;
  /** Saturday of the same week in dd.mm.yyyy format */
  readonly saturdayDate: string;
  /** Sunday of the same week in dd.mm.yyyy format */
  readonly sundayDate: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc016Data> {
    if (mode === "static") return new VacationTc016Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findRandomEmployee(db);
      return new VacationTc016Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC016_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;

    // Compute a future Mon-Sun week for testing
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    // Use 2 weeks ahead to avoid conflicts
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + 7);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    this.mondayDate = VacationTc016Data.toDdMmYyyy(monday);
    this.fridayDate = VacationTc016Data.toDdMmYyyy(friday);
    this.saturdayDate = VacationTc016Data.toDdMmYyyy(saturday);
    this.sundayDate = VacationTc016Data.toDdMmYyyy(sunday);
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
}

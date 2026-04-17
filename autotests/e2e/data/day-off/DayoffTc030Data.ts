declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findCpoWithFreeHoliday } from "./queries/dayoffQueries";

interface Tc030Args {
  cpoLogin: string;
  cpoName: string;
  originalDate: string;
  personalDate: string;
}

/**
 * TC-DO-030: CPO self-approval (PROJECT role).
 *
 * Finds a CPO/department manager with a free holiday slot.
 * The test creates the transfer request via UI (so the system auto-assigns
 * the CPO as their own approver), then navigates to the Approval page
 * to self-approve.
 */
export class DayoffTc030Data {
  readonly cpoLogin: string;
  readonly cpoName: string;
  readonly originalDate: string;
  readonly personalDate: string;

  constructor(
    cpoLogin = process.env.DAYOFF_TC030_CPO ?? "amalcev",
    cpoName = process.env.DAYOFF_TC030_CPO_NAME ?? "Мальцев Александр",
    originalDate = process.env.DAYOFF_TC030_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC030_PERS ?? "2026-07-07",
  ) {
    this.cpoLogin = cpoLogin;
    this.cpoName = cpoName;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc030Data> {
    if (mode === "static") return new DayoffTc030Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc030Args>("DayoffTc030Data");
      if (cached)
        return new DayoffTc030Data(
          cached.cpoLogin,
          cached.cpoName,
          cached.originalDate,
          cached.personalDate,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findCpoWithFreeHoliday(db);

      const instance = new DayoffTc030Data(
        row.cpoLogin,
        row.cpoName,
        row.originalDate,
        row.personalDate,
      );

        saveToDisk("DayoffTc030Data", {
          cpoLogin: row.cpoLogin,
          cpoName: row.cpoName,
          originalDate: row.originalDate,
          personalDate: row.personalDate,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Original date in display format DD.MM.YYYY for matching table rows. */
  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /** Personal date parsed for calendar picker selection. */
  get personalDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.personalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }

  /** Pattern to match CPO's last name in the approval table. */
  get employeePattern(): RegExp {
    const lastName = this.cpoName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}

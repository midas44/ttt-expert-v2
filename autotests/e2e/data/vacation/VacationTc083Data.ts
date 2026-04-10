declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc083Args {
  username: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-083: Null optionalApprovers → NPE on CPO path.
 * Uses pvaynmaster (CPO, API_SECRET_TOKEN owner) with a conflict-free week.
 * The test POSTs with optionalApprovers: null to trigger NPE in
 * VacationServiceImpl.createVacation() CPO branch:
 *   request.getOptionalApprovers().add(employee.getManager().getLogin())
 */
export class VacationTc083Data {
  readonly username: string;
  readonly startDateIso: string;
  readonly endDateIso: string;

  constructor(args: Tc083Args) {
    this.username = args.username;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc083Data> {
    if (mode === "static") {
      return new VacationTc083Data({
        username: "pvaynmaster",
        startDateIso: "2027-03-01",
        endDateIso: "2027-03-05",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc083Args>("VacationTc083Data");
      if (cached) return new VacationTc083Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const login = "pvaynmaster";
      const now = new Date();
      const day = now.getDay();
      const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;

      for (let w = 8; w < 52; w++) {
        const start = new Date(now);
        start.setDate(now.getDate() + daysToMon + w * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);
        const startIso = start.toISOString().slice(0, 10);
        const endIso = end.toISOString().slice(0, 10);

        if (!(await hasVacationConflict(db, login, startIso, endIso))) {
          const args: Tc083Args = {
            username: login,
            startDateIso: startIso,
            endDateIso: endIso,
          };
          saveToDisk("VacationTc083Data", args);
          return new VacationTc083Data(args);
        }
      }
      throw new Error("No conflict-free week found for pvaynmaster");
    } finally {
      await db.close();
    }
  }
}

import { loadSaved, saveToDisk } from "../savedDataStore";
import { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
  findAnotherManager,
} from "./queries/dayoffQueries";

interface Tc025Data {
  managerLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
  /** Another manager to add as optional approver */
  optionalApproverName: string;
}

export class DayoffTc025Data {
  private constructor(public readonly data: Tc025Data) {}

  get managerLogin(): string { return this.data.managerLogin; }
  get employeeName(): string { return this.data.employeeName; }
  get originalDate(): string { return this.data.originalDate; }
  get personalDate(): string { return this.data.personalDate; }
  get requestId(): number { return this.data.requestId; }
  get optionalApproverName(): string { return this.data.optionalApproverName; }

  static async create(
    mode: string,
    config: TttConfig,
  ): Promise<DayoffTc025Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc025Data>("DayoffTc025Data");
      if (cached) return new DayoffTc025Data(cached);
    }

    if (mode === "dynamic" || mode === "saved") {
      const db = new DbClient(config);
      try {
        // Try reusing an existing NEW request first; create only if none exist
        let req = await findNewDayoffRequestWithManager(db);
        if (!req) {
          req = await createNewDayoffRequest(db);
        }
        const otherMgr = await findAnotherManager(db, req.managerLogin);
        const data: Tc025Data = {
          managerLogin: req.managerLogin,
          employeeName: req.employeeName,
          originalDate: req.originalDate,
          personalDate: req.personalDate,
          requestId: req.requestId,
          optionalApproverName: otherMgr.fullName,
        };
        saveToDisk("DayoffTc025Data", data);
        return new DayoffTc025Data(data);
      } finally {
        await db.close();
      }
    }
    // Static fallback
    return new DayoffTc025Data({
      managerLogin: "perekrest",
      employeeName: "Тестовый Сотрудник",
      originalDate: "2026-06-12",
      personalDate: "2026-06-19",
      requestId: 0,
      optionalApproverName: "Иван Иванов",
    });
  }
}

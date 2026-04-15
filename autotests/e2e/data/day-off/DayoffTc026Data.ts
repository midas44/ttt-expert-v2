import { loadSaved, saveToDisk } from "../savedDataStore";
import { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  findAnotherManager,
} from "./queries/dayoffQueries";

interface Tc026Data {
  managerLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
  /** Another manager to add then remove as optional approver */
  optionalApproverName: string;
}

export class DayoffTc026Data {
  private constructor(public readonly data: Tc026Data) {}

  get managerLogin(): string { return this.data.managerLogin; }
  get employeeName(): string { return this.data.employeeName; }
  get originalDate(): string { return this.data.originalDate; }
  get personalDate(): string { return this.data.personalDate; }
  get requestId(): number { return this.data.requestId; }
  get optionalApproverName(): string { return this.data.optionalApproverName; }

  static async create(
    mode: string,
    config: TttConfig,
  ): Promise<DayoffTc026Data> {
    if (mode === "saved") {
      const cached = loadSaved<Tc026Data>("DayoffTc026Data");
      if (cached) return new DayoffTc026Data(cached);
    }

    if (mode === "dynamic" || mode === "saved") {
      const db = new DbClient(config);
      try {
        const req = await findNewDayoffRequestWithManager(db);
        if (!req) throw new Error("No NEW dayoff request available for TC-026");
        const otherMgr = await findAnotherManager(db, req.managerLogin);
        const data: Tc026Data = {
          managerLogin: req.managerLogin,
          employeeName: req.employeeName,
          originalDate: req.originalDate,
          personalDate: req.personalDate,
          requestId: req.requestId,
          optionalApproverName: otherMgr.fullName,
        };
        saveToDisk("DayoffTc026Data", data);
        return new DayoffTc026Data(data);
      } finally {
        await db.close();
      }
    }
    return new DayoffTc026Data({
      managerLogin: "perekrest",
      employeeName: "Тестовый Сотрудник",
      originalDate: "2026-06-12",
      personalDate: "2026-06-19",
      requestId: 0,
      optionalApproverName: "Иванов Иван",
    });
  }
}

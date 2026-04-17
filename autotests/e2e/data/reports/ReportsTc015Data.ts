declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findContractorAndAdmin } from "./queries/reportQueries";

interface Tc015Args {
  adminLogin: string;
  contractorLogin: string;
}

/**
 * TC-RPT-015: Contractor report page — spinner bug (regression #3150).
 * Needs an admin and a contractor employee.
 */
export class ReportsTc015Data {
  readonly adminLogin: string;
  readonly contractorLogin: string;

  constructor(
    adminLogin = process.env.RPT_TC015_ADMIN ?? "pvaynmaster",
    contractorLogin = process.env.RPT_TC015_CONTRACTOR ?? "contractor1",
  ) {
    this.adminLogin = adminLogin;
    this.contractorLogin = contractorLogin;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc015Data> {
    if (mode === "static") return new ReportsTc015Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc015Args>("ReportsTc015Data");
      if (cached) {
        return new ReportsTc015Data(cached.adminLogin, cached.contractorLogin);
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const result = await findContractorAndAdmin(db);
      const args: Tc015Args = {
        adminLogin: result.adminLogin,
        contractorLogin: result.contractorLogin,
      };
      saveToDisk("ReportsTc015Data", args);
      return new ReportsTc015Data(args.adminLogin, args.contractorLogin);
    } finally {
      await db.close();
    }
  }
}

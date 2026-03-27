declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findOptionalApproverFor } from "./queries/vacationQueries";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc021Args {
  optionalApproverLogin: string;
  optionalApproverName: string;
  vacationOwner: string;
  vacationOwnerName: string;
  startDateIso: string;
  endDateIso: string;
}

/**
 * TC-VAC-021: Optional approver — approve.
 * Creates a vacation with an optional approver via API.
 * Optional approver logs in and approves on the Agreement tab.
 */
export class VacationTc021Data {
  readonly optionalApproverLogin: string;
  readonly optionalApproverName: string;
  readonly vacationOwner: string;
  readonly vacationOwnerName: string;
  readonly vacationOwnerLastName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc021Args) {
    this.optionalApproverLogin = args.optionalApproverLogin;
    this.optionalApproverName = args.optionalApproverName;
    this.vacationOwner = args.vacationOwner;
    this.vacationOwnerName = args.vacationOwnerName;
    this.vacationOwnerLastName =
      args.vacationOwnerName.split(" ").pop() ?? args.vacationOwnerName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc021Data> {
    const vacationOwner = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc021Data({
        optionalApproverLogin: process.env.VAC_TC021_OA ?? "kchapkevich",
        optionalApproverName: "Ksenia Chapkevich",
        vacationOwner,
        vacationOwnerName: "Pavel Weinmeister",
        startDateIso: "2026-10-05",
        endDateIso: "2026-10-09",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc021Args>("VacationTc021Data");
      if (cached) return new VacationTc021Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const oa = await findOptionalApproverFor(db, vacationOwner);

      const ownerRow = await db.queryOne<{ display_name: string }>(
        `SELECT COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS display_name
         FROM ttt_vacation.employee e
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.login = $1`,
        [vacationOwner],
      );

      const { startDate, endDate } =
        await ApiVacationSetupFixture.findAvailableWeek(
          tttConfig,
          vacationOwner,
          4,
          20,
        );

      const args: Tc021Args = {
        optionalApproverLogin: oa.login,
        optionalApproverName: oa.display_name,
        vacationOwner,
        vacationOwnerName: ownerRow.display_name,
        startDateIso: startDate,
        endDateIso: endDate,
      };

      if (mode === "saved") saveToDisk("VacationTc021Data", args);
      return new VacationTc021Data(args);
    } finally {
      await db.close();
    }
  }
}

function toPeriodPattern(startIso: string, endIso: string): RegExp {
  if (!startIso || !endIso) return /./;
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const sd = parseInt(startIso.split("-")[2], 10);
  const ed = parseInt(endIso.split("-")[2], 10);
  const em = MONTHS[parseInt(endIso.split("-")[1], 10)];
  return new RegExp(`${sd}.*${ed}.*${em}`);
}

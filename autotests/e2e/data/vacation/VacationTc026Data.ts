declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findAccountantForEmployee } from "./queries/vacationQueries";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";

interface Tc026Args {
  accountantLogin: string;
  vacationOwner: string;
  startDateIso: string;
  endDateIso: string;
  paymentMonth: string;
  paymentMonthLabel: string;
}

/**
 * TC-VAC-026: Pay ADMINISTRATIVE vacation.
 * SETUP: API creates + approves an ADMINISTRATIVE vacation for pvaynmaster.
 * Test: login as accountant → Vacation Payment page → pay.
 * NOTE: PAID+EXACT vacations are terminal and undeletable.
 */
export class VacationTc026Data {
  readonly accountantLogin: string;
  readonly vacationOwner: string;
  readonly vacationOwnerName: string;
  readonly vacationOwnerLastName: string;
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly paymentMonth: string;
  readonly paymentMonthLabel: string;
  readonly periodPattern: RegExp;

  constructor(args: Tc026Args, ownerName = "Pavel Weinmeister") {
    this.accountantLogin = args.accountantLogin;
    this.vacationOwner = args.vacationOwner;
    this.vacationOwnerName = ownerName;
    this.vacationOwnerLastName = ownerName.split(" ").pop() ?? ownerName;
    this.startDateIso = args.startDateIso;
    this.endDateIso = args.endDateIso;
    this.paymentMonth = args.paymentMonth;
    this.paymentMonthLabel = args.paymentMonthLabel;
    this.periodPattern = toPeriodPattern(args.startDateIso, args.endDateIso);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc026Data> {
    const vacationOwner = "pvaynmaster";

    if (mode === "static") {
      return new VacationTc026Data({
        accountantLogin: process.env.VAC_TC026_ACCOUNTANT ?? "iromanenko",
        vacationOwner,
        startDateIso: "2026-10-12",
        endDateIso: "2026-10-16",
        paymentMonth: "2026-10-01",
        paymentMonthLabel: "Oct 2026",
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc026Args>("VacationTc026Data");
      if (cached) return new VacationTc026Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const accountant = await findAccountantForEmployee(db, vacationOwner);
      const { startDate, endDate } =
        await ApiVacationSetupFixture.findAvailableWeek(
          tttConfig,
          vacationOwner,
          3,
          20,
        );

      const paymentMonth = `${startDate.slice(0, 8)}01`;
      const paymentMonthLabel = toMonthLabel(startDate);

      const ownerRow = await db.queryOne<{ display_name: string }>(
        `SELECT COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS display_name
         FROM ttt_vacation.employee e
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.login = $1`,
        [vacationOwner],
      );

      const args: Tc026Args = {
        accountantLogin: accountant.login,
        vacationOwner,
        startDateIso: startDate,
        endDateIso: endDate,
        paymentMonth,
        paymentMonthLabel,
      };

      saveToDisk("VacationTc026Data", args);
      return new VacationTc026Data(args, ownerRow.display_name);
    } finally {
      await db.close();
    }
  }
}

function toMonthLabel(iso: string): string {
  const MONTHS = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [y, m] = iso.split("-");
  return `${MONTHS[parseInt(m, 10)]} ${y}`;
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

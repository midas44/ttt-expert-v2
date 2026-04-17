import type { Page, Locator } from "@playwright/test";
import { resolveFirstVisible } from "@utils/locatorResolver";

/** Month name → zero-based index lookup for calendar navigation. */
const MONTH_MAP: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3,
  May: 4, June: 5, July: 6, August: 7,
  September: 8, October: 9, November: 10, December: 11,
};

/**
 * Page object for the sick leave create/edit dialog.
 *
 * Create mode title: "Adding sick note"
 * Edit mode title: "Editing sick note"
 *
 * Fields: Start date*, End date*, Calendar days (auto), Number of the sick note,
 * file upload area, Notify also (combobox), Cancel / Save buttons.
 */
export class SickLeaveCreateDialog {
  private readonly dialog = this.page.getByRole("dialog");
  private readonly datePickerInputs = this.dialog.locator(
    "input[placeholder='DD.MM.YYYY'], input.date-picker__input",
  );
  private readonly numberInput = this.dialog.locator(
    "input",
  ).nth(2); // Third input: after start date and end date
  private readonly saveButton = this.dialog.getByRole("button", {
    name: /save/i,
  });
  private readonly cancelButton = this.dialog.getByRole("button", {
    name: /cancel/i,
  });

  constructor(private readonly page: Page) {}

  /** Waits for the dialog to become visible. */
  async waitForOpen(): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
  }

  /** Returns the root dialog locator. */
  root(): Locator {
    return this.dialog;
  }

  /** Sets the start date by typing into the first date picker. Format: dd.mm.yyyy */
  async fillStartDate(dateStr: string): Promise<void> {
    await this.selectDate(0, dateStr);
  }

  /** Sets the end date by typing into the second date picker. Format: dd.mm.yyyy */
  async fillEndDate(dateStr: string): Promise<void> {
    await this.selectDate(1, dateStr);
  }

  /** Fills both start and end dates. Format: dd.mm.yyyy */
  async fillDates(start: string, end: string): Promise<void> {
    await this.selectDate(0, start);
    await this.selectDate(1, end);
  }

  /** Reads the auto-calculated "Calendar days" value from the dialog. */
  async getCalendarDays(): Promise<string> {
    return this.dialog.evaluate((el) => {
      for (const node of el.querySelectorAll("strong, b")) {
        if (/calendar days/i.test(node.textContent ?? "")) {
          const parent = node.parentElement;
          if (parent) {
            const full = parent.textContent?.trim() ?? "";
            const match = full.match(/calendar days[:\s]*(\d+)/i);
            if (match) return match[1];
          }
        }
      }
      const allText = el.textContent ?? "";
      const match = allText.match(/calendar days[:\s]*(\d+)/i);
      return match ? match[1] : "0";
    });
  }

  /** Fills the "Number of the sick note" field. */
  async fillNumber(number: string): Promise<void> {
    // Find the input near the "Number of the sick note" label
    const candidates = [
      this.dialog.locator("input").filter({
        has: this.page.locator("..").filter({ hasText: /Number of the sick note/i }),
      }),
      this.dialog.locator("input[type='text']").nth(2),
    ];
    // Use a simpler approach: the number input is the standalone text input
    // (not inside a date-picker wrapper)
    const numberArea = this.dialog.locator("div").filter({
      hasText: /Number of the sick note/i,
    }).last();
    const input = numberArea.locator("input");
    if (await input.count() > 0) {
      await input.fill(number);
    } else {
      // Fallback: third input overall
      await this.dialog.locator("input").nth(2).fill(number);
    }
  }

  /** Returns the current value of the number field. */
  async getNumberValue(): Promise<string> {
    const numberArea = this.dialog.locator("div").filter({
      hasText: /Number of the sick note/i,
    }).last();
    const input = numberArea.locator("input");
    if (await input.count() > 0) {
      return (await input.inputValue()) ?? "";
    }
    return "";
  }

  /** Clicks Save to submit the form. */
  async submit(): Promise<void> {
    await this.saveButton.click();
  }

  /** Clicks Cancel to dismiss the dialog. */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.dialog.waitFor({ state: "detached" }).catch(() => {});
  }

  /** Returns true if the Save button is enabled. */
  async isSaveEnabled(): Promise<boolean> {
    return this.saveButton.isEnabled();
  }

  /** Returns true if the dialog is visible. */
  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  /** Returns the dialog heading text. */
  async getTitle(): Promise<string> {
    const heading = this.dialog.locator("h2");
    return (await heading.textContent())?.trim() ?? "";
  }

  /**
   * Selects a date via the calendar widget.
   * @param pickerIndex 0 for start date, 1 for end date
   * @param dateStr format: dd.mm.yyyy
   */
  private async selectDate(pickerIndex: number, dateStr: string): Promise<void> {
    const [dayStr, monthStr, yearStr] = dateStr.split(".");
    const targetDay = parseInt(dayStr, 10);
    const targetMonth = parseInt(monthStr, 10) - 1;
    const targetYear = parseInt(yearStr, 10);

    const input = this.datePickerInputs.nth(pickerIndex);
    await input.click();

    const calendarTable = input.locator("..").locator("table").first();
    await calendarTable.waitFor({ state: "visible", timeout: 5000 });

    // Navigate to target month/year
    const prevButton = calendarTable.locator("th").filter({ hasText: "‹" });
    const nextButton = calendarTable.locator("th").filter({ hasText: "›" });

    for (let attempts = 0; attempts < 24; attempts++) {
      const headerText = await calendarTable
        .locator("thead tr")
        .first()
        .locator("th")
        .nth(1)
        .textContent();
      if (!headerText) break;

      const { month, year } = this.parseCalendarHeader(headerText.trim());
      if (month === targetMonth && year === targetYear) break;

      const target = targetYear * 12 + targetMonth;
      const current = year * 12 + month;
      if (target > current) {
        await nextButton.click();
      } else {
        await prevButton.click();
      }
    }

    // Click target day (avoid grayed-out adjacent-month cells)
    const currentMonthDay = calendarTable.locator(
      "tbody td:not(.rdtOld):not(.rdtNew)",
    ).filter({ hasText: new RegExp(`^${targetDay}$`) });

    if ((await currentMonthDay.count()) > 0) {
      await currentMonthDay.first().click();
      return;
    }

    // Fallback: any cell matching the day number
    const allDayCells = await calendarTable.locator("tbody td").all();
    for (const cell of allDayCells) {
      const text = (await cell.textContent())?.trim();
      if (text !== String(targetDay)) continue;
      const isGrayed = await cell.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return parseFloat(s.opacity) < 0.5 ||
          el.classList.contains("rdtOld") ||
          el.classList.contains("rdtNew");
      });
      if (!isGrayed) {
        await cell.click();
        return;
      }
    }

    await calendarTable
      .locator("tbody td")
      .filter({ hasText: new RegExp(`^${targetDay}$`) })
      .first()
      .click();
  }

  private parseCalendarHeader(header: string): { month: number; year: number } {
    const parts = header.split(/\s+/);
    const monthName = parts[0];
    const year = parseInt(parts[parts.length - 1], 10);
    const month = MONTH_MAP[monthName] ?? 0;
    return { month, year };
  }
}

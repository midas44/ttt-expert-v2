import type { Page, Locator } from "@playwright/test";
import { pollForMatch } from "@utils/locatorResolver";
import { escapeRegExp } from "@utils/stringUtils";

/**
 * Page object for the "Days off" tab at /vacation/my/daysoff.
 * This tab lives under the "My vacations and days off" page alongside the "Vacations" tab.
 */
export class DayOffPage {
  /** Tab buttons at the top of the page (supports EN and RU). */
  private readonly vacationsTab = this.page.getByRole("button", {
    name: /^(Vacations|Отпуска)$/i,
  });
  private readonly daysOffTab = this.page.getByRole("button", {
    name: /^(Days off|Выходные)$/i,
  });

  /** Table structure. */
  private readonly table = this.page.locator("table");
  private readonly tableRows = this.table.locator("tbody tr");
  private readonly tableHeaders = this.table.locator("thead th");

  /** Year selector datepicker. */
  private readonly yearSelector = this.page.locator(
    "input[class*='datepicker'], input[class*='year'], .rdtPicker",
  );

  /** Notification candidates (multi-strategy). */
  private readonly notificationCandidates: Locator[];

  constructor(private readonly page: Page) {
    this.notificationCandidates = [
      page.locator(".notification__theme--visible"),
      page.locator("[class*='notification'][class*='visible']"),
      page.getByRole("status"),
      page.getByRole("alert"),
      page.locator("[class*='notification']"),
      page.locator("[class*='toast']"),
    ];
  }

  /** Navigate directly to the Days off tab URL. */
  async goto(appUrl: string): Promise<void> {
    await this.page.goto(`${appUrl}/vacation/my/daysoff`, {
      waitUntil: "domcontentloaded",
    });
    // Wait for any initial React rendering + data fetch to complete
    await this.page.waitForLoadState("networkidle").catch(() => {
      // Some TTT pages never reach networkidle due to background polling
    });
  }

  /** Click the Days off tab button. */
  async clickDaysOffTab(): Promise<void> {
    await this.daysOffTab.click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Click the Vacations tab button. */
  async clickVacationsTab(): Promise<void> {
    await this.vacationsTab.click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Wait for the day-off table to be visible (waits for at least one data row). */
  async waitForReady(): Promise<void> {
    await this.page.getByRole("table").waitFor({ state: "visible" });
  }

  /** Returns the count of visible data rows. */
  async getRowCount(): Promise<number> {
    // Filter out "no data" rows (single merged cell)
    return this.tableRows.evaluateAll((rows: Element[]) =>
      rows.filter(
        (r) =>
          (r as HTMLElement).offsetParent !== null &&
          r.querySelectorAll("td").length > 1,
      ).length,
    );
  }

  /** Returns all visible header texts. */
  async getHeaderTexts(): Promise<string[]> {
    return this.tableHeaders.allTextContents();
  }

  /**
   * Returns a row locator matching the given date text pattern.
   * Date format in the table: "DD.MM.YYYY (weekday)" or arrow format.
   */
  dayOffRow(datePattern: string | RegExp): Locator {
    if (typeof datePattern === "string") {
      return this.tableRows.filter({
        hasText: new RegExp(escapeRegExp(datePattern)),
      });
    }
    return this.tableRows.filter({ hasText: datePattern });
  }

  /** Returns the text content of a specific column in a day-off row. */
  async columnValue(
    datePattern: string | RegExp,
    columnLabel: string,
  ): Promise<string> {
    const row = this.dayOffRow(datePattern).first();
    const colIndex = await this.resolveColumnIndex(columnLabel);
    if (colIndex === -1) {
      throw new Error(`Column "${columnLabel}" not found in day-off table`);
    }
    const cell = row.locator("td").nth(colIndex);
    return (await cell.textContent()) ?? "";
  }

  /** Returns all text values for a given column across visible rows. */
  async getColumnTexts(columnLabel: string): Promise<string[]> {
    const colIndex = await this.resolveColumnIndex(columnLabel);
    if (colIndex === -1) throw new Error(`Column "${columnLabel}" not found`);
    return this.table
      .locator("tbody")
      .first()
      .locator("tr")
      .evaluateAll(
        (rows: Element[], idx: number) =>
          rows
            .filter((r) => (r as HTMLElement).offsetParent !== null)
            .filter((r) => r.querySelectorAll("td").length > idx)
            .map(
              (r) => r.querySelectorAll("td")[idx]?.textContent?.trim() ?? "",
            ),
        colIndex,
      );
  }

  /** Clicks the edit (pencil) icon on a day-off row. */
  async clickEditButton(datePattern: string | RegExp): Promise<void> {
    const row = this.dayOffRow(datePattern).first();
    await row
      .locator("[data-testid='dayoff-action-edit']")
      .click();
  }

  /** Clicks the cancel (red X) button on a day-off row. */
  async clickCancelButton(datePattern: string | RegExp): Promise<void> {
    const row = this.dayOffRow(datePattern).first();
    await row
      .locator("[data-testid='dayoff-action-cancel']")
      .click();
  }

  /** Checks if the edit button is present on a row. */
  async hasEditButton(datePattern: string | RegExp): Promise<boolean> {
    const row = this.dayOffRow(datePattern).first();
    return (
      (await row.locator("[data-testid='dayoff-action-edit']").count()) > 0
    );
  }

  /** Checks if the cancel button is present on a row. */
  async hasCancelButton(datePattern: string | RegExp): Promise<boolean> {
    const row = this.dayOffRow(datePattern).first();
    return (
      (await row.locator("[data-testid='dayoff-action-cancel']").count()) > 0
    );
  }

  /** Returns a notification locator containing the given text. */
  async findNotification(text: string, timeout = 15_000): Promise<Locator> {
    const textPattern = new RegExp(escapeRegExp(text), "i");
    const candidates = this.notificationCandidates.map((loc) =>
      loc.filter({ hasText: textPattern }),
    );
    return pollForMatch(candidates, { timeout, interval: 300 });
  }

  /** Returns the status text for a given row (supports EN and RU headers). */
  async getRowStatus(datePattern: string | RegExp): Promise<string> {
    return this.columnValueBilingual(datePattern, "Status", "Статус");
  }

  /** Returns the duration text for a given row (supports EN and RU headers). */
  async getRowDuration(datePattern: string | RegExp): Promise<string> {
    return this.columnValueBilingual(datePattern, "Duration", "Длительность");
  }

  /** Tries the primary column label, falls back to the alternative. */
  private async columnValueBilingual(
    datePattern: string | RegExp,
    label: string,
    altLabel: string,
  ): Promise<string> {
    const colIndex = await this.resolveColumnIndex(label);
    if (colIndex >= 0) return this.columnValue(datePattern, label);
    return this.columnValue(datePattern, altLabel);
  }

  /** Clicks a year in the year selector. */
  async selectYear(year: number): Promise<void> {
    // The year selector is a react-datetime input[name='date-picker']
    const yearInput = this.page.locator("input[name='date-picker']").first();
    await yearInput.click();

    // The year grid opens — find and click the target year cell
    const yearCell = this.page
      .locator(".rdt td")
      .filter({ hasText: new RegExp(`^${year}$`) });
    await yearCell.first().click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** Gets the tooltip text for the edit icon on a day-off row. */
  async getEditButtonTooltip(
    datePattern: string | RegExp,
  ): Promise<string> {
    const row = this.dayOffRow(datePattern).first();
    const editBtn = row.locator("[data-testid='dayoff-action-edit']");

    // Try title attribute on the button or its wrapper
    const btnTitle = await editBtn.getAttribute("title");
    if (btnTitle) return btnTitle;
    const parentTitle = await editBtn
      .locator("xpath=..")
      .getAttribute("title");
    if (parentTitle) return parentTitle;

    // Hover and wait for tooltip element
    await editBtn.hover();
    await this.page.waitForTimeout(5000);

    const tooltipCandidates = [
      this.page.getByRole("tooltip"),
      this.page.locator("[class*='tooltip']").filter({ hasText: /.+/ }),
    ];
    for (const loc of tooltipCandidates) {
      if ((await loc.count()) > 0) {
        const text = await loc.first().textContent();
        if (text?.trim()) return text.trim();
      }
    }

    return "";
  }

  /** Returns the text content of the first cell (date column) in a row. */
  async getRowFirstCellText(
    datePattern: string | RegExp,
  ): Promise<string> {
    const row = this.dayOffRow(datePattern).first();
    return (await row.locator("td").first().textContent())?.trim() ?? "";
  }

  /** Checks whether a row's date cell contains the arrow (\u2192) format. */
  async rowHasArrowFormat(
    datePattern: string | RegExp,
  ): Promise<boolean> {
    const text = await this.getRowFirstCellText(datePattern);
    return text.includes("\u2192");
  }

  /** Returns the current URL path. */
  currentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  private async resolveColumnIndex(columnLabel: string): Promise<number> {
    // Use the visible table's headers only (exclude hidden dialog tables)
    const visibleTable = this.page.locator("table:visible");
    return visibleTable.locator("thead th").evaluateAll(
      (headers: Element[], label: string) => {
        // Filter to visible headers from the first visible table
        const visible = headers.filter(
          (h) => (h as HTMLElement).offsetParent !== null,
        );
        // Find headers belonging to the first table that has them
        const firstTable = visible[0]?.closest("table");
        const tableHeaders = firstTable
          ? visible.filter((h) => h.closest("table") === firstTable)
          : visible;
        for (let i = 0; i < tableHeaders.length; i++) {
          if (
            tableHeaders[i].textContent
              ?.trim()
              .toLowerCase()
              .includes(label.toLowerCase())
          ) {
            return i;
          }
        }
        return -1;
      },
      columnLabel,
    );
  }
}

import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the Availability Chart page (/vacation/chart).
 * Shows a day-by-day (or month-by-month) timeline of employee absences.
 *
 * UI structure:
 * - Title: "Availability chart"
 * - Search: textbox "Search by employee / project / manager / salary office"
 * - Filter chips: Employee, Project, Manager, Salary office
 * - Toggle: "Days" | "Months" buttons
 * - Month navigation: prev/next arrows, month/year textbox
 * - Table: header rows (month names, day numbers + day-of-week), body rows per employee
 *
 * Note: The underlying <table> may report as hidden due to CSS overflow.
 * Locators use force-visible patterns to access the chart grid.
 */
export class AvailabilityChartPage {
  constructor(private readonly page: Page) {}

  /** Waits for the chart page to load. */
  async waitForReady(): Promise<void> {
    await this.page
      .locator("text=Availability chart")
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    await this.page
      .getByRole("button", { name: "Days", exact: true })
      .waitFor({ state: "visible", timeout: 10000 });
    // The chart table is in a scrollable container with overflow: hidden.
    // Playwright reports table elements as hidden. Wait for DOM attachment only.
    await this.page.locator("table tbody tr").first().waitFor({
      state: "attached",
      timeout: 15000,
    });
  }

  /** Returns the page title locator. */
  titleLocator(): Locator {
    return this.page.locator("text=Availability chart").first();
  }

  /** Returns the "Days" toggle button. */
  daysToggle(): Locator {
    return this.page.getByRole("button", { name: "Days", exact: true });
  }

  /** Returns the "Months" toggle button. */
  monthsToggle(): Locator {
    return this.page.getByRole("button", { name: "Months", exact: true });
  }

  /** Returns the search textbox. */
  searchBox(): Locator {
    return this.page.getByRole("textbox", {
      name: /search by employee/i,
    });
  }

  /** Returns all employee rows in the chart table body. */
  employeeRows(): Locator {
    return this.page.locator("table tbody tr");
  }

  /** Returns the first column cells (employee names). */
  employeeNameCells(): Locator {
    return this.page.locator("table tbody tr td:first-child");
  }

  /**
   * Returns all column headers from the header rows.
   */
  columnHeaders(): Locator {
    return this.page.locator("table thead th");
  }

  /**
   * Returns a specific employee row by name fragment.
   */
  employeeRow(nameFragment: string): Locator {
    return this.page.locator("table tbody tr").filter({ hasText: nameFragment });
  }

  // --- Days view navigation (MonthControl component) ---

  /** The datePickerContainer holding prev button, month input, next button. */
  private datePickerContainer(): Locator {
    return this.page.locator('[class*="datePickerContainer"]');
  }

  /** Clicks the previous month arrow in Days view. */
  async clickPrevMonth(): Promise<void> {
    await this.datePickerContainer().locator("button").first().click();
  }

  /** Clicks the next month arrow in Days view. */
  async clickNextMonth(): Promise<void> {
    await this.datePickerContainer().locator("button").last().click();
  }

  /** Returns the current month/year text from the Days view navigation input. */
  async getMonthYearText(): Promise<string> {
    return await this.datePickerContainer().locator("input").inputValue();
  }

  // --- Months view ---

  /** Switches to Months view and waits for it to load. */
  async switchToMonthsView(): Promise<void> {
    await this.monthsToggle().click();
    // Months view replaces MonthControl with date range pickers
    await this.page
      .locator('input[placeholder="dd.mm.yyyy"]')
      .first()
      .waitFor({ state: "visible", timeout: 10000 });
    // Wait for table to re-render with month columns
    await this.page.locator("table tbody tr").first().waitFor({
      state: "attached",
      timeout: 15000,
    });
  }

  /** Returns month column header texts in Months view (e.g. "2026\nMarch"). */
  async getMonthColumnHeaders(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll("table thead th"));
      return ths
        .map((th) => th.textContent?.trim() ?? "")
        .filter((t) => /\d{4}\s*[A-Z]/.test(t));
    });
  }

  /** Returns the start date input value in Months view. */
  async getMonthsStartDate(): Promise<string> {
    return await this.page
      .locator('input[placeholder="dd.mm.yyyy"]')
      .first()
      .inputValue();
  }

  /** Returns the end date input value in Months view. */
  async getMonthsEndDate(): Promise<string> {
    return await this.page
      .locator('input[placeholder="dd.mm.yyyy"]')
      .last()
      .inputValue();
  }

  /**
   * Navigates to the specified month by clicking prev/next arrows.
   * targetMonth format: "MMMM YYYY" (e.g., "June 2026") or "MM.YYYY" (e.g., "06.2026").
   */
  async navigateToMonth(targetYear: number, targetMonth: number): Promise<void> {
    const MONTHS = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const targetStr = `${MONTHS[targetMonth - 1]} ${targetYear}`;
    const maxAttempts = 24;

    for (let i = 0; i < maxAttempts; i++) {
      const current = await this.getMonthYearText();
      if (current.includes(targetStr) || current.includes(`${String(targetMonth).padStart(2, "0")}.${targetYear}`)) {
        return;
      }
      // Parse current month to decide direction
      const match = current.match(/(\w+)\s+(\d{4})/);
      if (match) {
        const curMonthIdx = MONTHS.findIndex((m) =>
          m.toLowerCase().startsWith(match[1].toLowerCase()),
        );
        const curYear = parseInt(match[2], 10);
        const curTotal = curYear * 12 + curMonthIdx;
        const targetTotal = targetYear * 12 + (targetMonth - 1);
        if (targetTotal > curTotal) {
          await this.clickNextMonth();
        } else {
          await this.clickPrevMonth();
        }
      } else {
        await this.clickNextMonth();
      }
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Returns the count of colored (non-empty background) day cells for an employee row.
   * Vacations show as colored cells (green for approved, etc.).
   */
  async getColoredCellCount(nameFragment: string): Promise<number> {
    return this.page.evaluate((name) => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const row = rows.find((r) => r.textContent?.includes(name));
      if (!row) return 0;
      const cells = Array.from(row.querySelectorAll("td")).slice(1); // skip name cell
      return cells.filter((td) => {
        const bg = window.getComputedStyle(td).backgroundColor;
        // Non-white, non-transparent backgrounds indicate colored cells
        return bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(255, 255, 255)" && bg !== "transparent";
      }).length;
    }, nameFragment);
  }

  /** Returns the count of employee rows via DOM (bypasses CSS-hidden). */
  async getEmployeeRowCount(): Promise<number> {
    return await this.page.evaluate(() =>
      document.querySelectorAll("table tbody tr").length,
    );
  }

  /** Returns all employee names from the chart via DOM. */
  async getEmployeeNames(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const cells = document.querySelectorAll("table tbody tr td:first-child");
      return Array.from(cells)
        .map((c) => c.textContent?.trim() ?? "")
        .filter((n) => n.length > 0);
    });
  }
}

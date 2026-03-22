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
}

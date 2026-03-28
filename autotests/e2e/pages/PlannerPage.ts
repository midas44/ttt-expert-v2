import type { Locator, Page } from "@playwright/test";

export class PlannerPage {
  constructor(private readonly page: Page) {}

  /** Waits for the planner page to be ready by checking the Planner heading. */
  async waitForReady(): Promise<void> {
    await this.page
      .locator("h1, h2, [class*='title']")
      .filter({ hasText: "Planner" })
      .first()
      .waitFor({ state: "visible" });
  }

  /** Clicks the "Tasks" tab. */
  async clickTasksTab(): Promise<void> {
    await this.page.getByRole("button", { name: "Tasks", exact: true }).click();
  }

  /** Clicks the "Projects" tab. */
  async clickProjectsTab(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Projects", exact: true })
      .click();
  }

  /** Selects a project from the project dropdown by typing and selecting. */
  async selectProject(projectName: string): Promise<void> {
    const combobox = this.page
      .locator("[class*='planner__project-select']")
      .getByRole("combobox");
    await combobox.click();
    await combobox.fill(projectName);
    await this.page
      .getByRole("option", { name: projectName, exact: true })
      .click();
  }

  /** Changes the role filter dropdown ("Show projects where I am a ..."). */
  async selectRoleFilter(role: string): Promise<void> {
    const label = this.page.getByText("Show projects where I am a");
    const control = label.locator("..").locator("[class*='selectbox__control']").first();
    await control.scrollIntoViewIfNeeded();
    await control.click({ force: true });
    await this.page.getByRole("option", { name: role, exact: true }).click();
  }

  /** Clicks the Project Settings icon (unnamed SVG in .planner__project-group-add). */
  async clickProjectSettingsIcon(): Promise<void> {
    await this.page
      .locator(".planner__project-group-add .uikit-button")
      .first()
      .click();
  }

  /** Returns the Actions dropdown button. */
  actionsButton(): Locator {
    return this.page.getByRole("button", { name: "Actions" });
  }

  /** Returns the planner data table. */
  dataTable(): Locator {
    return this.page.getByRole("table");
  }

  /** Waits for the Project Settings dialog to be visible. */
  async waitForSettingsDialog(): Promise<void> {
    await this.page.getByRole("dialog").waitFor({ state: "visible" });
  }

  /** Clicks the OK button in the Project Settings dialog. */
  async clickSettingsOk(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "OK" })
      .click();
  }

  /** Checks if the Project Settings icon is visible (PM-only control). */
  async isProjectSettingsIconVisible(): Promise<boolean> {
    const count = await this.page
      .locator(".planner__project-group-add .uikit-button")
      .count();
    if (count === 0) return false;
    return this.page
      .locator(".planner__project-group-add .uikit-button")
      .first()
      .isVisible();
  }

  /** Returns the search bar input locator. */
  searchBar(): Locator {
    return this.page.getByRole("combobox").first();
  }

  /** Returns the search bar wrapper with placeholder text. */
  searchBarWrapper(): Locator {
    return this.page.locator("[class*='planner__search']");
  }

  /** Clicks the next-day (right) button beside the date header. */
  async navigateDateForward(): Promise<void> {
    const dateHeader = this.page.locator(".planner__header-day");
    // Next-day button is the sibling button AFTER the date text
    const parent = dateHeader.locator("..");
    await parent.locator("button").last().click();
  }

  /** Clicks the prev-day (left) button beside the date header. */
  async navigateDateBackward(): Promise<void> {
    const dateHeader = this.page.locator(".planner__header-day");
    // Prev-day button is the sibling button BEFORE the date text
    const parent = dateHeader.locator("..");
    await parent.locator("button").first().click();
  }

  /** Returns the current date text displayed in the table header. */
  async getDateHeaderTexts(): Promise<string[]> {
    const headers = this.page.locator("table thead th");
    const count = await headers.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  /** Returns the date display text (e.g., "Fri\n28.03") from the planner header. */
  async getDateDisplayText(): Promise<string> {
    return (
      (await this.page.locator(".planner__header-day").textContent()) ?? ""
    );
  }

  /** Returns the locator for the "Total" row at the bottom of the table. */
  totalRow(): Locator {
    return this.page.locator("tr").filter({ hasText: /^Total/ });
  }

  /** Returns the project name shown in the project selector dropdown. */
  async getSelectedProjectName(): Promise<string> {
    const singleValue = this.page
      .locator("[class*='planner__project-select'] [class*='singleValue']");
    return (await singleValue.textContent()) ?? "";
  }

  /** Returns the project select dropdown wrapper. */
  projectSelectDropdown(): Locator {
    return this.page.locator("[class*='planner__project-select']");
  }

  /** Returns the combobox inside the project select dropdown. */
  projectSelectCombobox(): Locator {
    return this.page
      .locator("[class*='planner__project-select']")
      .getByRole("combobox");
  }
}

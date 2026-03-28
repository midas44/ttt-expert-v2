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
}

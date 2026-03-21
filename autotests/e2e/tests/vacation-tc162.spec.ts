import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc162Data } from "../data/VacationTc162Data";
import type { Page } from "@playwright/test";

/** Extract "X in YYYY" vacation days display from the My Vacations page.
 *  Waits up to 10s for the display to show a non-zero value (the API response
 *  may arrive after the page skeleton renders with initial "0 in YYYY"). */
async function readVacationDaysDisplay(page: Page): Promise<{ days: number; year: number; raw: string }> {
  await page.getByText("Available vacation days:").waitFor({ state: "visible", timeout: 10000 });

  // Poll: the React component initially renders "0 in YYYY" and updates after its API call resolves
  const raw = await page.evaluate(async () => {
    const maxWait = 10000;
    const interval = 300;
    let elapsed = 0;
    while (elapsed < maxWait) {
      const spans = document.querySelectorAll("span");
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && /^\d+\s+in\s+\d{4}$/.test(text) && !text.startsWith("0 ")) return text;
      }
      await new Promise(r => setTimeout(r, interval));
      elapsed += interval;
    }
    // Final attempt — accept even "0 in YYYY" if that's genuinely the value
    const spans = document.querySelectorAll("span");
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && /^\d+\s+in\s+\d{4}$/.test(text)) return text;
    }
    return null;
  });
  if (!raw) throw new Error("Could not find vacation days display (matching /\\d+ in \\d{4}/)");
  const m = raw.match(/(\d+)\s+in\s+(\d{4})/);
  return { days: Number(m![1]), year: Number(m![2]), raw };
}

test("vacation_tc162 - AV=true vacation days display uses availablePaidDays @regress", async ({ page, request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc162Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const availUrl = tttConfig.buildUrl(`${data.availableDaysEndpoint}?${data.buildAvailableQuery()}`);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Login via CAS and navigate to My Vacations page
    await page.goto(tttConfig.appUrl);
    await page.locator("input[name='username']").fill(data.login);
    await page.getByRole("button", { name: "LOGIN" }).click();
    await page.waitForURL(`**${tttConfig.dashboardPath}**`);

    // Navigate to My Vacations page — wait for the available days API call to complete
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200),
      page.goto(`${tttConfig.appUrl}${data.myVacationsPath}`),
    ]);
    await page.locator(".page-body__title:has-text('My vacations and days off')").waitFor({ state: "visible" });

    // Step 2: Read UI display — "X in YYYY" pattern
    const baseline = await readVacationDaysDisplay(page);

    const step2Artifact = testInfo.outputPath("step2-ui-baseline.json");
    await writeFile(step2Artifact, JSON.stringify({
      uiText: baseline.raw,
      uiAvailDays: baseline.days,
      uiYear: baseline.year,
      note: "MR !5169 fix: UI should display availablePaidDays, not currentYear",
    }, null, 2), "utf-8");
    await testInfo.attach("step2-ui-baseline", { path: step2Artifact, contentType: "application/json" });

    expect(baseline.days, "UI should display a valid number").not.toBeNaN();
    expect(baseline.year, "UI should display current year").toBe(new Date().getFullYear());

    // Step 3: API — GET available days baseline
    const availResp = await request.get(availUrl, { headers: authHeaders });
    const availBody = await availResp.json();

    const step3Artifact = testInfo.outputPath("step3-api-baseline.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: availResp.status(),
      availablePaidDays: availBody.availablePaidDays,
      currentYear: availBody.currentYear,
      body: availBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-api-baseline", { path: step3Artifact, contentType: "application/json" });

    expect(availResp.status()).toBe(200);
    const apiAvailPaidDays = Number(availBody.availablePaidDays ?? 0);

    // Step 4: Verify UI matches API availablePaidDays
    const step4Artifact = testInfo.outputPath("step4-ui-vs-api.json");
    await writeFile(step4Artifact, JSON.stringify({
      uiAvailDays: baseline.days,
      apiAvailPaidDays,
      apiCurrentYear: availBody.currentYear,
      uiMatchesAvailPaidDays: baseline.days === apiAvailPaidDays,
      uiMatchesCurrentYear: baseline.days === Number(availBody.currentYear ?? 0),
      note: "UI should match availablePaidDays (not currentYear field). " +
        "After MR !5169 fix, these may differ for AV=true with cross-year vacations.",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-ui-vs-api", { path: step4Artifact, contentType: "application/json" });

    expect(
      baseline.days,
      "UI display should match API availablePaidDays",
    ).toBe(apiAvailPaidDays);

    // Step 5: Create vacation via API, then verify UI updates
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();

    expect(createResp.status(), "Create vacation should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const regularDays = Number(createBody.vacation?.regularDays ?? 0);

    // Refresh the page — wait for the available days API response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200),
      page.reload(),
    ]);
    await page.locator(".page-body__title:has-text('My vacations and days off')").waitFor({ state: "visible" });

    const afterCreate = await readVacationDaysDisplay(page);

    // Also check API after creation
    const availRespAfter = await request.get(availUrl, { headers: authHeaders });
    const availBodyAfter = await availRespAfter.json();
    const apiAvailPaidDaysAfter = Number(availBodyAfter.availablePaidDays ?? 0);

    const step5Artifact = testInfo.outputPath("step5-after-create.json");
    await writeFile(step5Artifact, JSON.stringify({
      regularDays,
      uiAvailDaysBefore: baseline.days,
      uiAvailDaysAfter: afterCreate.days,
      uiDecrease: baseline.days - afterCreate.days,
      apiAvailPaidDaysAfter,
      apiDecrease: apiAvailPaidDays - apiAvailPaidDaysAfter,
      uiMatchesApiAfter: afterCreate.days === apiAvailPaidDaysAfter,
    }, null, 2), "utf-8");
    await testInfo.attach("step5-after-create", { path: step5Artifact, contentType: "application/json" });

    expect(afterCreate.days, "UI should decrease after vacation create").toBeLessThan(baseline.days);
    expect(afterCreate.days, "UI should match API after create").toBe(apiAvailPaidDaysAfter);

    // Step 6: Delete vacation and verify UI restores
    await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    createdVacationId = null;

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200),
      page.reload(),
    ]);
    await page.locator(".page-body__title:has-text('My vacations and days off')").waitFor({ state: "visible" });

    const afterDelete = await readVacationDaysDisplay(page);

    const step6Artifact = testInfo.outputPath("step6-after-delete.json");
    await writeFile(step6Artifact, JSON.stringify({
      uiAvailDaysBefore: baseline.days,
      uiAvailDaysRestored: afterDelete.days,
      restored: afterDelete.days === baseline.days,
    }, null, 2), "utf-8");
    await testInfo.attach("step6-after-delete", { path: step6Artifact, contentType: "application/json" });

    expect(
      afterDelete.days,
      "UI display should restore after vacation deletion",
    ).toBe(baseline.days);
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});

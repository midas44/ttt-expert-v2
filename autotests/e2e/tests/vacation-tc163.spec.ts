import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc163Data } from "../data/VacationTc163Data";
import { DbClient } from "../config/db/dbClient";
import type { Page } from "@playwright/test";

/** Extract "X in YYYY" vacation days display from the My Vacations page.
 *  Waits up to 10s for the display to show a non-zero value (the API response
 *  may arrive after the page skeleton renders with initial "0 in YYYY"). */
async function readVacationDaysDisplay(page: Page): Promise<{ days: number; year: number; raw: string }> {
  await page.getByText("Available vacation days:").waitFor({ state: "visible", timeout: 10000 });

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

test("vacation_tc163 - AV=true future vacations affect available days display @regress", async ({ page, request }, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc163Data.create(globalConfig.testDataMode, tttConfig);

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

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200),
      page.goto(`${tttConfig.appUrl}${data.myVacationsPath}`),
    ]);
    await page.locator(".page-body__title:has-text('My vacations and days off')").waitFor({ state: "visible" });

    // Step 2: Read UI baseline
    const baseline = await readVacationDaysDisplay(page);

    const step2Artifact = testInfo.outputPath("step2-ui-baseline.json");
    await writeFile(step2Artifact, JSON.stringify({
      uiText: baseline.raw,
      uiAvailDays: baseline.days,
      uiYear: baseline.year,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-ui-baseline", { path: step2Artifact, contentType: "application/json" });

    expect(baseline.days, "UI should display a valid number").not.toBeNaN();

    // Step 3: API baseline
    const availResp = await request.get(availUrl, { headers: authHeaders });
    const availBody = await availResp.json();
    expect(availResp.status()).toBe(200);
    const apiAvailBefore = Number(availBody.availablePaidDays ?? 0);

    const step3Artifact = testInfo.outputPath("step3-api-baseline.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: availResp.status(),
      availablePaidDays: apiAvailBefore,
      body: availBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-api-baseline", { path: step3Artifact, contentType: "application/json" });

    expect(baseline.days, "UI should match API baseline").toBe(apiAvailBefore);

    // Step 4: Create future vacation via API
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();

    expect(createResp.status(), "Create vacation should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const regularDays = Number(createBody.vacation?.regularDays ?? 0);

    const step4Artifact = testInfo.outputPath("step4-create-future-vacation.json");
    await writeFile(step4Artifact, JSON.stringify({
      vacationId: createdVacationId,
      startDate: data.startDate,
      endDate: data.endDate,
      regularDays,
      note: "Future vacation created — should affect current year available days via FIFO",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-create-future-vacation", { path: step4Artifact, contentType: "application/json" });

    // Step 5: Verify API shows decreased available days
    const availRespAfter = await request.get(availUrl, { headers: authHeaders });
    const availBodyAfter = await availRespAfter.json();
    const apiAvailAfter = Number(availBodyAfter.availablePaidDays ?? 0);

    const step5Artifact = testInfo.outputPath("step5-api-after-create.json");
    await writeFile(step5Artifact, JSON.stringify({
      apiAvailBefore,
      apiAvailAfter,
      apiDecrease: apiAvailBefore - apiAvailAfter,
      regularDays,
      futureVacationAffectsDisplay: apiAvailAfter < apiAvailBefore,
    }, null, 2), "utf-8");
    await testInfo.attach("step5-api-after-create", { path: step5Artifact, contentType: "application/json" });

    expect(apiAvailAfter, "API available days should decrease after future vacation").toBeLessThan(apiAvailBefore);

    // Step 6: Verify UI shows decreased available days
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200),
      page.reload(),
    ]);
    await page.locator(".page-body__title:has-text('My vacations and days off')").waitFor({ state: "visible" });

    const afterCreate = await readVacationDaysDisplay(page);

    const step6Artifact = testInfo.outputPath("step6-ui-after-create.json");
    await writeFile(step6Artifact, JSON.stringify({
      uiAvailBefore: baseline.days,
      uiAvailAfter: afterCreate.days,
      uiDecrease: baseline.days - afterCreate.days,
      uiMatchesApi: afterCreate.days === apiAvailAfter,
    }, null, 2), "utf-8");
    await testInfo.attach("step6-ui-after-create", { path: step6Artifact, contentType: "application/json" });

    expect(afterCreate.days, "UI should decrease after future vacation create").toBeLessThan(baseline.days);
    expect(afterCreate.days, "UI should match API after create").toBe(apiAvailAfter);

    // Step 7: DB — Verify vacation_days_distribution shows FIFO cross-year allocation
    const db = new DbClient(tttConfig);
    try {
      const distribution = await db.query<{ vacation: number; year: number; days: number }>(
        `SELECT vdd.vacation, vdd.year, vdd.days
         FROM ttt_vacation.vacation_days_distribution vdd
         WHERE vdd.vacation = $1
         ORDER BY vdd.year`,
        [createdVacationId],
      );

      const totalDistributed = distribution.reduce((s, d) => s + Number(d.days), 0);

      const step7Artifact = testInfo.outputPath("step7-db-distribution.json");
      await writeFile(step7Artifact, JSON.stringify({
        vacationId: createdVacationId,
        distribution,
        totalDistributed,
        regularDays,
        note: "FIFO: days consumed from earliest available balance year first",
      }, null, 2), "utf-8");
      await testInfo.attach("step7-db-distribution", { path: step7Artifact, contentType: "application/json" });

      expect(distribution.length, "Should have distribution records").toBeGreaterThan(0);
      expect(totalDistributed, "Distributed days should match regular days").toBe(regularDays);

      // Verify FIFO ordering: years should be ascending
      for (let i = 1; i < distribution.length; i++) {
        expect(
          distribution[i].year,
          "Distribution years should be ascending (FIFO)",
        ).toBeGreaterThanOrEqual(distribution[i - 1].year);
      }
    } finally {
      await db.close();
    }

    // Step 8: Delete vacation and verify restoration
    await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    createdVacationId = null;

    // Verify API restores
    const availRespRestored = await request.get(availUrl, { headers: authHeaders });
    const availBodyRestored = await availRespRestored.json();
    const apiAvailRestored = Number(availBodyRestored.availablePaidDays ?? 0);

    // Verify UI restores
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200),
      page.reload(),
    ]);
    await page.locator(".page-body__title:has-text('My vacations and days off')").waitFor({ state: "visible" });

    const afterDelete = await readVacationDaysDisplay(page);

    const step8Artifact = testInfo.outputPath("step8-after-delete.json");
    await writeFile(step8Artifact, JSON.stringify({
      uiAvailBefore: baseline.days,
      uiAvailRestored: afterDelete.days,
      apiAvailRestored,
      uiRestored: afterDelete.days === baseline.days,
      apiRestored: apiAvailRestored === apiAvailBefore,
    }, null, 2), "utf-8");
    await testInfo.attach("step8-after-delete", { path: step8Artifact, contentType: "application/json" });

    expect(afterDelete.days, "UI display should restore after deletion").toBe(baseline.days);
    expect(apiAvailRestored, "API should restore after deletion").toBe(apiAvailBefore);
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});

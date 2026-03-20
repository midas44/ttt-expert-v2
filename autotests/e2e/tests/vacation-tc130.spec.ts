import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc130Data } from "../data/VacationTc130Data";

test("vacation_tc130 - vacation list with filters (type, status, date range) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc130Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const scheduleBaseUrl = tttConfig.buildUrl(data.scheduleEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET with type=MY — should return pvaynmaster's own schedule
  const myUrl = data.buildFilterUrl(scheduleBaseUrl, { type: "MY" });
  const myResponse = await request.get(myUrl, { headers: authHeaders });

  const myBody = await myResponse.json();
  const myArtifact = testInfo.outputPath("step1-type-MY.json");
  await writeFile(myArtifact, JSON.stringify(myBody, null, 2), "utf-8");
  await testInfo.attach("step1-type-MY", { path: myArtifact, contentType: "application/json" });

  expect(myResponse.status(), `type=MY: expected 200, got ${myResponse.status()}`).toBe(200);
  // v2 availability-schedule uses totalCount (not totalElements)
  expect(myBody.totalCount, "totalCount should be defined").toBeDefined();
  expect(Array.isArray(myBody.content), "content should be an array").toBe(true);

  // Step 2: GET with type=ALL — should return data from multiple employees
  const allUrl = data.buildFilterUrl(scheduleBaseUrl, { type: "ALL" });
  const allResponse = await request.get(allUrl, { headers: authHeaders });

  const allBody = await allResponse.json();
  const allArtifact = testInfo.outputPath("step2-type-ALL.json");
  await writeFile(allArtifact, JSON.stringify(allBody, null, 2), "utf-8");
  await testInfo.attach("step2-type-ALL", { path: allArtifact, contentType: "application/json" });

  expect(allResponse.status(), `type=ALL: expected 200, got ${allResponse.status()}`).toBe(200);
  expect(allBody.totalCount).toBeDefined();
  // ALL should generally return more results than MY
  if (myBody.totalCount > 0) {
    expect(allBody.totalCount).toBeGreaterThanOrEqual(myBody.totalCount);
  }

  // Step 3: GET with type=APPROVER — vacations pending pvaynmaster's approval
  const approverUrl = data.buildFilterUrl(scheduleBaseUrl, { type: "APPROVER" });
  const approverResponse = await request.get(approverUrl, { headers: authHeaders });

  const approverBody = await approverResponse.json();
  const approverArtifact = testInfo.outputPath("step3-type-APPROVER.json");
  await writeFile(approverArtifact, JSON.stringify(approverBody, null, 2), "utf-8");
  await testInfo.attach("step3-type-APPROVER", { path: approverArtifact, contentType: "application/json" });

  expect(approverResponse.status(), `type=APPROVER: expected 200, got ${approverResponse.status()}`).toBe(200);
  expect(approverBody.totalCount).toBeDefined();

  // Step 4: GET with sort parameter — verify sort accepted
  const sortUrl = data.buildFilterUrl(scheduleBaseUrl, { type: "ALL", sort: "+login" });
  const sortResponse = await request.get(sortUrl, { headers: authHeaders });

  const sortBody = await sortResponse.json();
  const sortArtifact = testInfo.outputPath("step4-sort.json");
  await writeFile(sortArtifact, JSON.stringify(sortBody, null, 2), "utf-8");
  await testInfo.attach("step4-sort", { path: sortArtifact, contentType: "application/json" });

  expect(sortResponse.status(), `sort=+login: expected 200, got ${sortResponse.status()}`).toBe(200);

  // Step 5: GET with narrowed date range filter (from/to are the v2 param names)
  const dateUrl = data.buildFilterUrl(scheduleBaseUrl, {
    type: "ALL",
    from: "2026-01-01",
    to: "2026-06-30",
  });
  const dateResponse = await request.get(dateUrl, { headers: authHeaders });

  const dateBody = await dateResponse.json();
  const dateArtifact = testInfo.outputPath("step5-date-range.json");
  await writeFile(dateArtifact, JSON.stringify(dateBody, null, 2), "utf-8");
  await testInfo.attach("step5-date-range", { path: dateArtifact, contentType: "application/json" });

  expect(dateResponse.status(), `date filter: expected 200, got ${dateResponse.status()}`).toBe(200);
  expect(dateBody.totalCount).toBeDefined();

  // Step 6: GET with small pageSize — verify pagination works
  const pageUrl = data.buildFilterUrl(scheduleBaseUrl, {
    type: "ALL",
    page: "0",
    pageSize: "2",
  });
  const pageResponse = await request.get(pageUrl, { headers: authHeaders });

  const pageBody = await pageResponse.json();
  const pageArtifact = testInfo.outputPath("step6-pagination.json");
  await writeFile(pageArtifact, JSON.stringify(pageBody, null, 2), "utf-8");
  await testInfo.attach("step6-pagination", { path: pageArtifact, contentType: "application/json" });

  expect(pageResponse.status()).toBe(200);
  if (pageBody.totalCount > 2) {
    expect(pageBody.content.length).toBeLessThanOrEqual(2);
  }
});

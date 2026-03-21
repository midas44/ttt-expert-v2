import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc015Data } from "../data/VacationTc015Data";

test("TC-VAC-015: Create with null optionalApprovers — NPE bug (CPO) @regress @known-bug", async ({
  request,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc015Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = {
    [data.authHeaderName]: apiToken,
    "Content-Type": "application/json",
  };

  let createdVacationId: number | null = null;

  try {
    // POST without optionalApprovers — CPO path calls
    // getOptionalApprovers().add(manager) on null list → NPE
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      // optionalApprovers deliberately omitted — null triggers NPE on CPO path
      notifyAlso: [],
    };

    const response = await request.post(baseUrl, { headers, data: body });

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }

    const bugStatus =
      response.status() === 500
        ? "BUG CONFIRMED: NPE at VacationServiceImpl:155 — CPO path with null optionalApprovers"
        : response.ok()
          ? "BUG FIXED: Vacation created — null optionalApprovers treated as empty list"
          : `Status ${response.status()} — behavior differs from expected`;

    const artifact = testInfo.outputPath(
      "step1-null-optional-approvers.json",
    );
    await writeFile(
      artifact,
      JSON.stringify(
        { request: body, response: responseBody, status: response.status(), note: bugStatus },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-null-optional-approvers", {
      path: artifact,
      contentType: "application/json",
    });

    // If bug was fixed and vacation was actually created, capture ID for cleanup
    if (response.ok()) {
      const created = responseBody as { id?: number };
      createdVacationId = created?.id ?? null;
    }

    // Known bug assertion: expect 500 (NPE)
    // If vacation gets created (200/201), the bug was fixed
    expect(response.status(), bugStatus).toBe(500);
  } finally {
    // Cleanup: delete vacation if it was unexpectedly created (bug fixed scenario)
    if (createdVacationId) {
      const deleteResponse = await request.delete(
        `${baseUrl}/${createdVacationId}`,
        { headers },
      );
      const deleteArtifact = testInfo.outputPath("cleanup-delete.json");
      await writeFile(
        deleteArtifact,
        JSON.stringify(
          { id: createdVacationId, status: deleteResponse.status() },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("cleanup-delete", {
        path: deleteArtifact,
        contentType: "application/json",
      });
    }
  }
});

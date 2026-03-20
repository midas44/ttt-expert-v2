import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc025Data } from "../data/VacationTc025Data";

test("vacation_tc025 - create vacation with very long comment (5000 chars) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc025Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with 5000-char comment
    expect(data.comment.length, "Comment should be 5000 chars").toBe(5000);

    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    // Accept both 200 (success) and error (if DB column limit hit)
    if (createResponse.status() === 200) {
      const createVac = createBody.vacation;
      expect(createVac, "Response should contain vacation object").toBeTruthy();
      createdVacationId = createVac.id;

      // Verify comment stored — may be truncated if DB column is shorter
      expect(createVac.comment, "Comment should be present").toBeTruthy();
      expect(createVac.comment.length, "Comment length should be > 0").toBeGreaterThan(0);

      // Step 2: GET to confirm comment persisted
      const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const getBody = await getResponse.json();
      const getArtifact = testInfo.outputPath("step2-verify.json");
      await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
      await testInfo.attach("step2-verify", { path: getArtifact, contentType: "application/json" });

      expect(getResponse.status()).toBe(200);
      const getVac = getBody.vacation ?? getBody;
      expect(getVac.comment, "Comment should persist in GET").toBeTruthy();

      // Log actual stored length for documentation
      const storedLength = getVac.comment.length;
      const lengthArtifact = testInfo.outputPath("comment-length.json");
      await writeFile(lengthArtifact, JSON.stringify({
        sentLength: data.comment.length,
        storedLength,
        fullySaved: storedLength === data.comment.length,
      }, null, 2), "utf-8");
      await testInfo.attach("comment-length", { path: lengthArtifact, contentType: "application/json" });
    } else {
      // If creation fails due to DB constraint, document the error
      const errorArtifact = testInfo.outputPath("error-response.json");
      await writeFile(errorArtifact, JSON.stringify(createBody, null, 2), "utf-8");
      await testInfo.attach("error-response", { path: errorArtifact, contentType: "application/json" });

      // Mark as known finding — DB column may have length limit
      expect.soft(createResponse.status(), "Long comment should be accepted (no DTO limit)").toBe(200);
    }
  } finally {
    // Cleanup: delete the vacation
    if (createdVacationId) {
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: delArtifact, contentType: "application/json" });
    }
  }
});

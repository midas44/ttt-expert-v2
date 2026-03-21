import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc022Data } from "../data/VacationTc022Data";
import { DbClient } from "../config/db/dbClient";

test("TC-VAC-022: Create vacation with notifyAlso list @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc022Data.create(
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
    // Step 1: Create vacation with notifyAlso list
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: data.notifyAlsoLogins,
    };

    const createResponse = await request.post(baseUrl, { headers, data: body });
    const createJson = await createResponse.json();

    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        { request: body, response: createJson, status: createResponse.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-create", {
      path: createArtifact,
      contentType: "application/json",
    });

    expect(
      createResponse.ok(),
      `Create failed: ${createResponse.status()} ${JSON.stringify(createJson)}`,
    ).toBeTruthy();

    const vacationData = createJson.vacation ?? createJson;
    createdVacationId = vacationData.id;
    expect(createdVacationId, "Created vacation must have an id").toBeTruthy();
    expect(vacationData.status, "Initial status should be NEW").toBe("NEW");

    // Step 2: Verify vacation_notify_also records in DB
    const db = new DbClient(tttConfig);
    try {
      const notifyRows = await db.query<{
        vacation: number;
        approver: number;
        required: boolean;
      }>(
        `SELECT vna.vacation, vna.approver, vna.required
         FROM ttt_vacation.vacation_notify_also vna
         WHERE vna.vacation = $1
         ORDER BY vna.id`,
        [createdVacationId],
      );

      const dbArtifact = testInfo.outputPath("step2-db-notify-also.json");
      await writeFile(
        dbArtifact,
        JSON.stringify(
          {
            vacationId: createdVacationId,
            notifyAlsoLogins: data.notifyAlsoLogins,
            dbRows: notifyRows,
          },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("step2-db-notify-also", {
        path: dbArtifact,
        contentType: "application/json",
      });

      // Should have records for each notifyAlso login
      expect(
        notifyRows.length,
        `Should have ${data.notifyAlsoLogins.length} notify-also records in DB`,
      ).toBe(data.notifyAlsoLogins.length);

      // All records should have required=false (informational only)
      for (const row of notifyRows) {
        expect(
          Number(row.vacation),
          "FK should point to created vacation",
        ).toBe(createdVacationId);
        expect(row.required, "notifyAlso should have required=false").toBe(false);
      }

      // Step 3: Verify the approver FK points to valid employees matching the logins
      const employeeIds = notifyRows.map((r) => r.approver);
      const matchingEmployees = await db.query<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         WHERE e.id = ANY($1::bigint[])
         ORDER BY e.login`,
        [employeeIds],
      );

      const verifyArtifact = testInfo.outputPath("step3-verify-logins.json");
      await writeFile(
        verifyArtifact,
        JSON.stringify(
          {
            expectedLogins: data.notifyAlsoLogins.sort(),
            actualLogins: matchingEmployees.map((e) => e.login).sort(),
          },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("step3-verify-logins", {
        path: verifyArtifact,
        contentType: "application/json",
      });

      const actualLogins = matchingEmployees.map((e) => e.login).sort();
      const expectedLogins = [...data.notifyAlsoLogins].sort();
      expect(
        actualLogins,
        "DB notify-also employees should match requested logins",
      ).toEqual(expectedLogins);
    } finally {
      await db.close();
    }
  } finally {
    // Cleanup
    if (createdVacationId) {
      const deleteResponse = await request.delete(
        `${baseUrl}/${createdVacationId}`,
        { headers },
      );
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      await writeFile(
        cleanupArtifact,
        JSON.stringify(
          { id: createdVacationId, deleteStatus: deleteResponse.status() },
          null,
          2,
        ),
        "utf-8",
      );
      await testInfo.attach("cleanup-delete", {
        path: cleanupArtifact,
        contentType: "application/json",
      });
    }
  }
});

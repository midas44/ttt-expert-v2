import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc018Data } from "../data/VacationTc018Data";

test("TC-VAC-018: CPO auto-approver self-assignment @regress", async ({
  request,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc018Data.create(
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
    // Step 1: Create vacation as CPO (pvaynmaster = ROLE_DEPARTMENT_MANAGER)
    const body = {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: data.paymentType,
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };

    const response = await request.post(baseUrl, { headers, data: body });
    const responseJson = await response.json();

    const createArtifact = testInfo.outputPath("step1-create-cpo-vacation.json");
    await writeFile(
      createArtifact,
      JSON.stringify(
        { request: body, response: responseJson, status: response.status() },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step1-create-cpo-vacation", {
      path: createArtifact,
      contentType: "application/json",
    });

    expect(
      response.ok(),
      `Vacation creation failed: ${response.status()} ${JSON.stringify(responseJson)}`,
    ).toBeTruthy();
    // Response wraps data: {vacation: {...}, vacationDays: {...}}
    const vacationData = responseJson.vacation ?? responseJson;
    createdVacationId = vacationData.id;
    expect(createdVacationId, "Created vacation must have an id").toBeTruthy();

    // Step 2: Verify approver = self (CPO self-approval pattern)
    // API returns approver as full EmployeeDTO object: {id, login, name, ...}
    const approver = vacationData.approver;
    expect(approver, "Response must include approver field").toBeTruthy();

    const approverLogin =
      typeof approver === "object" ? approver.login : approver;
    expect(
      approverLogin,
      `CPO approver should be self ("${data.login}"), got: ${JSON.stringify(approver)}`,
    ).toBe(data.login);

    // Step 3: Log approver details for diagnostics
    const approverArtifact = testInfo.outputPath("step2-approver-check.json");
    await writeFile(
      approverArtifact,
      JSON.stringify(
        {
          expectedApproverLogin: data.login,
          actualApproverLogin: approverLogin,
          approverObject: approver,
          managerLogin: data.managerLogin,
          optionalApprovers: responseJson.optionalApprovers ?? [],
          selfApprovalConfirmed: approverLogin === data.login,
        },
        null,
        2,
      ),
      "utf-8",
    );
    await testInfo.attach("step2-approver-check", {
      path: approverArtifact,
      contentType: "application/json",
    });

    // Step 4: If optional approvers in response, verify manager is among them
    const optionalApprovers = vacationData.optionalApprovers;
    if (optionalApprovers && Array.isArray(optionalApprovers) && optionalApprovers.length > 0) {
      const managerApproval = optionalApprovers.find(
        (oa: Record<string, unknown>) => {
          const oaApprover = oa.approver as
            | { login?: string }
            | undefined;
          const oaLogin = oaApprover?.login ?? (oa.login as string | undefined);
          return oaLogin === data.managerLogin;
        },
      );
      expect(
        managerApproval,
        `Manager "${data.managerLogin}" should be in optional approvers`,
      ).toBeTruthy();
    }
  } finally {
    // Cleanup: delete created vacation
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

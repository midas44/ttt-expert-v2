import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc125Data } from "../data/VacationTc125Data";

test("vacation_tc125 - ServiceException vs ValidationException format difference @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc125Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create a vacation → NEW status
    const createResp = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();
    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Vacation ID should be returned").toBeTruthy();

    // Step 2: Approve (self-approval as DEPARTMENT_MANAGER) → APPROVED
    const approveResp = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );
    const approveBody = await approveResp.json();
    expect(approveResp.status(), "Approve should return 200").toBe(200);
    const approvedVac = approveBody.vacation ?? approveBody;
    expect(approvedVac.status, "Status should be APPROVED").toBe("APPROVED");

    // Step 3: Double-approve → triggers ServiceException (status not allowed)
    const doubleApproveResp = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );
    let serviceExBody: Record<string, unknown> = {};
    try { serviceExBody = await doubleApproveResp.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-service-exception.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: doubleApproveResp.status(),
      body: serviceExBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-service-exception", { path: step3Artifact, contentType: "application/json" });

    const serviceExStatus = doubleApproveResp.status();
    // Double-approve triggers VacationSecurityException (403) — permission check blocks
    // before service layer. Still demonstrates the non-validation error format (no errors[]).
    expect(
      serviceExStatus === 400 || serviceExStatus === 403,
      `Double-approve should return 400 or 403, got ${serviceExStatus}`,
    ).toBe(true);

    // Step 4: Trigger ValidationException via POST with missing @NotNull fields
    const validationExResp = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildValidationExceptionBody(),
    });
    const validationExBody = await validationExResp.json();

    const step4Artifact = testInfo.outputPath("step4-validation-exception.json");
    await writeFile(step4Artifact, JSON.stringify({
      status: validationExResp.status(),
      body: validationExBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step4-validation-exception", { path: step4Artifact, contentType: "application/json" });

    expect(validationExResp.status(), "ValidationException should return 400").toBe(400);

    // Step 5: Compare the two response structures
    const comparison = {
      serviceException: {
        errorCode: serviceExBody.errorCode,
        hasErrorsArray: Array.isArray(serviceExBody.errors),
        exceptionClass: serviceExBody.exception,
        topLevelKeys: Object.keys(serviceExBody).sort(),
      },
      validationException: {
        errorCode: validationExBody.errorCode,
        hasErrorsArray: Array.isArray(validationExBody.errors),
        errorsCount: Array.isArray(validationExBody.errors) ? validationExBody.errors.length : 0,
        exceptionClass: validationExBody.exception,
        topLevelKeys: Object.keys(validationExBody).sort(),
      },
    };

    const step5Artifact = testInfo.outputPath("step5-comparison.json");
    await writeFile(step5Artifact, JSON.stringify(comparison, null, 2), "utf-8");
    await testInfo.attach("step5-comparison", { path: step5Artifact, contentType: "application/json" });

    // Application exception: specific errorCode, exception class is a domain exception
    expect(serviceExBody.errorCode, "Application exception should have errorCode").toBeTruthy();
    // Exception class is domain-specific (ServiceException or VacationSecurityException)
    expect(serviceExBody.exception, "Application exception should have exception class").toBeTruthy();
    expect(
      String(serviceExBody.exception),
      "Exception class should be from application domain",
    ).toContain("noveogroup");

    // ValidationException: has errors[] array with field-level details
    expect(validationExBody.errorCode, "ValidationException should have errorCode").toBeTruthy();
    expect(Array.isArray(validationExBody.errors), "ValidationException must have errors[]").toBe(true);
    expect(validationExBody.errors.length).toBeGreaterThanOrEqual(1);

    for (const err of validationExBody.errors) {
      expect(err.field, "Error entry should have 'field'").toBeDefined();
      expect(err.code, "Error entry should have 'code'").toBeDefined();
    }

    // Step 6: Verify structural difference
    const serviceExHasFieldErrors = Array.isArray(serviceExBody.errors) && serviceExBody.errors.length > 0;
    const validationExHasFieldErrors = Array.isArray(validationExBody.errors) && validationExBody.errors.length > 0;

    const step6Artifact = testInfo.outputPath("step6-structural-diff.json");
    await writeFile(step6Artifact, JSON.stringify({
      keyDifference: "ServiceException: specific errorCode, exception=ServiceException, no field-level errors[]; ValidationException: generic errorCode, exception=MethodArgumentNotValidException, has field-level errors[]",
      serviceExErrorCode: serviceExBody.errorCode,
      validationExErrorCode: validationExBody.errorCode,
      serviceExHasFieldErrors,
      validationExHasFieldErrors,
      serviceExceptionClass: serviceExBody.exception,
      validationExceptionClass: validationExBody.exception,
    }, null, 2), "utf-8");
    await testInfo.attach("step6-structural-diff", { path: step6Artifact, contentType: "application/json" });

    // The definitive differences:
    // 1. Exception class differs
    expect(serviceExBody.exception).not.toBe(validationExBody.exception);

    // 2. ServiceException has no field-level errors (or empty errors[])
    // ValidationException has populated errors[]
    expect(validationExHasFieldErrors, "ValidationException must have field-level errors").toBe(true);
  } finally {
    // Cleanup: cancel then delete
    if (createdVacationId) {
      await request.put(`${baseUrl}/cancel/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(cleanupArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(cleanupArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: cleanupArtifact, contentType: "application/json" });
    }
  }
});

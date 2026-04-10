# Bugs — #2724 Close-by-Tag Feature

## Summary

| # | Severity | Area | Title | Status |
|---|----------|------|-------|--------|
| BUG-1 | MEDIUM | Frontend | Whitespace-only tag input bypasses validation, causes server error | NEW |
| BUG-2 | LOW | Frontend | API calls to `/projects/undefined/close-tags` on initial page load | NEW |
| BUG-3 | LOW | Frontend | No green highlight on newly added tag rows | NEW |
| BUG-4 | ~~BLOCKER~~ | ~~Deployment~~ | ~~Apply endpoint not deployed~~ — **RESOLVED** after redeploy (build 26.03) | RESOLVED |
| BUG-5 | MEDIUM | Frontend | Silent failure — no error notification when apply API fails | NEW |
| BUG-6 | MEDIUM | Frontend | Inline tag editing does not activate on click/double-click | NEW |
| BUG-7 | MEDIUM | Backend | No permission check on apply endpoint — any PM can apply on any project | CONFIRMED |
| BUG-8 | LOW | Frontend | No 200-char limit enforced — 201+ chars accepted (Confluence says 200, DB allows 255) | CONFIRMED |

---

## Detailed Bug Reports

### BUG-1: Whitespace-only tag input bypasses frontend validation
- **Severity:** MEDIUM
- **Component:** Frontend — `PlannerTagsAdd.js` (Formik/Yup validation)
- **Reproduce:**
  1. Open Project Settings > Tasks Closing tab
  2. Type spaces only (`"   "`) in the tag input field
  3. Click "+" button
- **Expected:** Frontend treats whitespace as empty input and shows "Mandatory field" error. Per Confluence req 7.4.2: _"entering space(s) should be treated as empty input"_
- **Actual:** Frontend sends whitespace string to `POST /v1/projects/{id}/close-tags`. Backend rejects with `@NotBlank` validator. User sees generic error banner "An error has occurred in the system" instead of field-level validation.
- **Fix suggestion:** Add `.trim()` in Yup validation or use `string().trim().required()` instead of `mixed().required()`.

### BUG-2: API calls to `/projects/undefined/close-tags` on initial page load
- **Severity:** LOW
- **Component:** Frontend — `plannerProjects/sagas.tsx`
- **Reproduce:**
  1. Navigate to Planner > Projects tab
  2. Observe console before selecting any project
- **Expected:** No API calls until a project is selected
- **Actual:** `GET /api/ttt/v1/projects/undefined/members` and `GET /api/ttt/v1/projects/undefined/close-tags` are called, returning 404. Error banner briefly appears.
- **Fix suggestion:** Guard the fetch saga with `if (!projectId) return;` check before dispatching API calls.

### BUG-3: No green highlight on newly added tag rows
- **Severity:** LOW (cosmetic)
- **Component:** Frontend — `PlannerTagsList.js` or CSS
- **Reproduce:**
  1. Open Tasks Closing tab
  2. Add a new tag
  3. Observe the new row
- **Expected:** 5px green left border on the new row (per Figma mockup and Confluence 7.4.4: "newly added item must be highlighted green")
- **Actual:** No green highlight visible

### BUG-4: Apply endpoint not deployed — returns 500 "POST not supported"
- **Severity:** BLOCKER (feature non-functional)
- **Component:** Deployment — QA-1 environment
- **Reproduce:**
  1. Open Project Settings for any project
  2. Add a tag on Tasks Closing tab
  3. Click OK
- **Expected:** `POST /v1/projects/{id}/close-tags/apply` succeeds, assignments are processed
- **Actual:** Returns `500 Internal Server Error`:
  ```json
  {
    "exception": "org.springframework.web.HttpRequestMethodNotSupportedException",
    "message": "Request method 'POST' not supported",
    "path": "/v1/projects/3119/close-tags/apply"
  }
  ```
- **Root cause:** QA-1 build date is **22.03.2026** (from page footer). The `/apply` endpoint was added on **25.03.2026** (commit `97c8013a`, Backend v11 / MR !5335). The backend hasn't been redeployed since. Spring matches `/close-tags/apply` as `/{tagId}` pattern (DELETE/PATCH only), hence "POST not supported".
- **Impact:** The core close-by-tag feature is completely non-functional. OK button silently fails. No assignments can be closed via tags.
- **Resolution needed:** Redeploy QA-1 backend from latest `release/2.1` branch.
- **Note on earlier 502 reports:** The 502 errors observed during testing were due to curl requests bypassing VPN (going through proxy). The backend was always operational — confirmed via playwright-vpn browser.

### BUG-5: Silent failure — no error notification on apply
- **Severity:** MEDIUM
- **Component:** Frontend — `plannerProjects/sagas.tsx`, `handleCloseTagsApply`
- **Reproduce:**
  1. Click OK when apply endpoint fails (any error condition)
- **Expected:** User-visible error notification (e.g., "An error has occurred")
- **Actual:** Dialog closes. No error message. No page reload. User has no indication the operation failed.
- **Root cause:** Saga catch block only calls `devLog(error)`. Missing `yield put(setErrorGlobalEvent())` which every other saga in the same file uses.
- **Fix suggestion:** Add `yield put(setErrorGlobalEvent())` in the catch block.

### BUG-6: Inline tag editing does not activate
- **Severity:** MEDIUM
- **Component:** Frontend — `PlannerTag.js`
- **Reproduce:**
  1. Open Tasks Closing tab with existing tags
  2. Click on a tag text (e.g., "[closed]")
  3. Double-click on the tag text
- **Expected:** Tag text becomes editable input field (inline editing as per Confluence 7.4.4)
- **Actual:** Nothing happens. Cell is not interactive.
- **Possible root cause:** The `PlannerTag` component's `onClick` handler may not be wired to the DOM element correctly, or the component may not be rendered for tag cells (only for employee role cells).

### BUG-7: No permission check on apply endpoint — CONFIRMED
- **Severity:** MEDIUM → **HIGH** (any PM can affect any project)
- **Component:** Backend — `CloseByTagServiceImpl.apply()`, `PlannerCloseTagController`
- **From:** Stage B static analysis (H1), **dynamically confirmed in Stage D**
- **Reproduce:**
  1. Log in as `dergachev` (has global PM role, but is NOT a member of Diabolocom-AI project 3134)
  2. Call `POST /v1/projects/3134/close-tags/apply` with body `{"date":"2026-03-31","plannerSection":"TABS_ASSIGNMENTS_PROJECT"}`
  3. Response: **200 OK** (no permission error)
- **Expected:** 403 Forbidden — only PMs who are members of the project should be able to apply close-by-tag
- **Actual:** 200 OK — any authenticated user with global PM role can trigger close-by-tag for ANY project
- **Impact:** A PM working on one project could accidentally or intentionally close assignments on another project they're not involved with. This is a security/authorization issue.
- **Fix suggestion:** Add `PlannerCloseTagPermissionService.validate(projectId)` call in the `apply()` method, same as other tag operations.
- **Status:** CONFIRMED dynamically on 2026-03-30 during clock change test.

### BUG-8: No 200-char tag limit enforced (CONFIRMED)
- **Severity:** LOW
- **Component:** Frontend + Backend
- **From:** Stage B static analysis (M2)
- **Description:** No `@Size(max=255)` on `PlannerCloseTagCreateRequestDTO.tag`. No frontend max length. Tags > 255 chars will fail with raw DB error. Confluence specifies 200 char limit.
- **Status:** Not verified dynamically.

---
type: exploration
tags: [auth, jwt, api, vacation, playwright, autotest]
created: 2026-03-22
updated: 2026-03-22
status: active
related: ["[[vacation-service-deep-dive]]", "[[employee-requests-pages]]"]
---

# JWT Authentication Pattern for API Calls in E2E Tests

## Problem
Some test scenarios require API calls as a specific user (e.g., manager approves/rejects vacation). The available auth mechanisms:

1. **`API_SECRET_TOKEN` header** — authenticates as the token owner (pvaynmaster on qa-1), NOT as an arbitrary user. Returns 403 when trying to approve/reject vacations for employees whose manager is someone else.
2. **Browser session cookies** — NOT valid for vacation REST API calls (returns 401).
3. **`TTT_JWT_TOKEN` header** — accepts a JWT token for any user. Works for all API endpoints.

## Solution: Network Request Interception

The app stores JWT tokens and sends them in API requests. Capture the token by intercepting network requests from the user's browser page:

```typescript
let managerJwt = "";
managerPage.on("request", (req) => {
  const header = req.headers()["ttt_jwt_token"]
    || req.headers()["authorization"];
  if (header && !managerJwt) {
    managerJwt = header.replace(/^Bearer\s+/i, "");
  }
});

// Trigger a page load to capture an API request
await managerPage.reload({ waitUntil: "networkidle" });
expect(managerJwt, "JWT not captured from network requests").toBeTruthy();

// Use the captured JWT for API calls
const resp = await page.request.put(
  tttConfig.buildUrl(`/api/vacation/v1/vacations/approve/${vacationId}`),
  { headers: { TTT_JWT_TOKEN: managerJwt } },
);
```

## Why Not localStorage?
The JWT storage key in localStorage is inconsistent — sometimes "token", sometimes other keys. Network interception is more reliable because it captures the actual header the app uses.

## Vacation API Security Definitions
From Swagger spec:
- `apiKey`: header named `API_SECRET_TOKEN` — token value directly
- `jwtKey`: header named `TTT_JWT_TOKEN` — JWT value directly

## Applicable Endpoints
- `PUT /api/vacation/v1/vacations/approve/{vacationId}` — approve vacation
- `PUT /api/vacation/v1/vacations/reject/{vacationId}` — reject vacation
- Any endpoint that checks `@CurrentUser` and requires a specific user context

## When to Use This Pattern
- Test requires manager approval/rejection via API (My department tab has 58+ pages, unreliable for UI automation)
- Test requires API call as a specific user (not the API_SECRET_TOKEN owner)
- The user is already logged in via browser in a separate context

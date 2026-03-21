

## Selectors (discovered during Phase C, session 104)

### Available Vacation Days Display

The "Available vacation days:" section has this DOM structure:
```
div.UserVacationsPage_userVacationInfo__Mq+Yb
├── div.UserVacationsPage_userVacationDaysWrapper__XuOuL  (label wrapper)
│   ├── div.UserVacationsPage_vacationDaysRowContainer__0lgn+
│   │   └── text: "Available vacation days:"
│   └── link: "Vacation regulation"
└── div.UserVacationsPage_userVacationDaysWrapper__XuOuL  (value wrapper)
    └── div.UserVacationsPage_vacationDaysRowContainer__0lgn+
        ├── span: "125 in 2026"   ← unique <span> on page
        └── button (expand icon)
```

**Key behavior**: React renders initial "0 in YYYY", then updates after async API call to `/vacationdays/available`.

**Reliable selector pattern** (used in TC-162):
```typescript
// Wait for API response first
await page.waitForResponse(resp => resp.url().includes("/vacationdays/available") && resp.status() === 200);

// Then poll for non-zero value in <span>
const text = await page.evaluate(async () => {
  const maxWait = 10000, interval = 300;
  let elapsed = 0;
  while (elapsed < maxWait) {
    for (const span of document.querySelectorAll("span")) {
      const t = span.textContent?.trim();
      if (t && /^\d+\s+in\s+\d{4}$/.test(t) && !t.startsWith("0 ")) return t;
    }
    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;
  }
  // Fallback: accept "0 in YYYY"
  for (const span of document.querySelectorAll("span")) {
    const t = span.textContent?.trim();
    if (t && /^\d+\s+in\s+\d{4}$/.test(t)) return t;
  }
  return null;
});
```

### Headless Browser Proxy Bypass

`chrome-headless-shell` ignores `--no-proxy-server` flag. Must run with:
```bash
HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= npx playwright test ...
```

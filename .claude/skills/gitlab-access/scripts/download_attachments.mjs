#!/usr/bin/env node

/**
 * Download GitLab upload attachments via headless browser (Puppeteer).
 *
 * GitLab CE 16.x serves issue uploads through web routes that require
 * a browser session. The PAT does not work for these URLs.
 * This script logs in via LDAP and downloads each file.
 *
 * Usage:
 *   node download_attachments.mjs \
 *     --login <username> \
 *     --password <password> \
 *     --output <directory> \
 *     --urls <url1> [url2] ...
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - Puppeteer installed: cd /tmp && npm install puppeteer
 *   - Google Chrome on the system
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { basename } from 'path';

// ---------------------------------------------------------------------------
// Resolve puppeteer — try several known locations
// ---------------------------------------------------------------------------
let puppeteer;
const candidates = [
  '/tmp/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js',
  '/tmp/node_modules/puppeteer',
  'puppeteer'
];
for (const loc of candidates) {
  try {
    const mod = await import(loc);
    puppeteer = mod.default || mod;
    break;
  } catch { /* try next */ }
}
if (!puppeteer) {
  console.error('Puppeteer not found. Install it first: cd /tmp && npm install puppeteer');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse CLI arguments
// Supports both --key value and --credentials-file path (JSON with login/password)
// ---------------------------------------------------------------------------
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
function getArgList(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return [];
  const values = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    values.push(args[i]);
  }
  return values;
}

// Support reading credentials from a JSON file to avoid shell escaping issues
// File format: { "login": "...", "password": "..." }
let login = getArg('login');
let password = getArg('password');
const credsFile = getArg('credentials-file');
if (credsFile) {
  try {
    const creds = JSON.parse(readFileSync(credsFile, 'utf-8'));
    login = login || creds.login;
    password = password || creds.password;
  } catch (e) {
    console.error(`Failed to read credentials file: ${e.message}`);
    process.exit(1);
  }
}

const outdir = getArg('output') || './downloads';
const urls = getArgList('urls');

if (!login || !password || urls.length === 0) {
  console.error('Usage: node download_attachments.mjs --login <user> --password <pass> --output <dir> --urls <url1> [url2] ...');
  console.error('   or: node download_attachments.mjs --credentials-file <path.json> --output <dir> --urls <url1> [url2] ...');
  process.exit(1);
}

// Ensure output directory exists
if (!existsSync(outdir)) {
  mkdirSync(outdir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const GITLAB_BASE = urls[0].match(/^https?:\/\/[^/]+/)?.[0] || 'https://gitlab.noveogroup.com';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
page.setDefaultNavigationTimeout(60000);

// Step 1: Load sign-in page
console.log('Loading sign-in page...');
await page.goto(`${GITLAB_BASE}/users/sign_in`, { waitUntil: 'domcontentloaded' });

// Step 2: Fill LDAP form (default tab)
// IMPORTANT: Use #ldapmain_* selectors, NOT #user_* (Standard tab)
const usernameField = await page.$('#ldapmain_username');
const passwordField = await page.$('#ldapmain_password');

if (!usernameField || !passwordField) {
  console.error('Could not find LDAP form fields. The sign-in page layout may have changed.');
  await browser.close();
  process.exit(1);
}

await usernameField.type(login);
await passwordField.type(password);

// Step 3: Submit
const submitBtn = await page.$('button[type="submit"], input[type="submit"], input[name="commit"]');
await submitBtn.click();

try {
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
} catch { /* may have already navigated */ }

// Step 4: Verify login
const currentUrl = page.url();
if (currentUrl.includes('sign_in')) {
  console.error('Login failed — still on sign-in page. Check credentials.');
  await browser.close();
  process.exit(1);
}
console.log('Login successful.');

// Step 5: Download each URL
const results = [];
for (const url of urls) {
  const filename = basename(new URL(url).pathname);
  console.log(`Downloading ${filename}...`);

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const contentType = resp.headers()['content-type'] || '';
    const status = resp.status();

    if (status === 200 && !contentType.includes('text/html')) {
      const buffer = await resp.buffer();
      const outpath = `${outdir}/${filename}`;
      writeFileSync(outpath, buffer);
      console.log(`  Saved: ${outpath} (${buffer.length} bytes, ${contentType})`);
      results.push({ filename, status: 'ok', bytes: buffer.length, contentType });
    } else {
      console.log(`  Skipped: status=${status}, content-type=${contentType}`);
      results.push({ filename, status: 'skipped', reason: `${status} ${contentType}` });
    }
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    results.push({ filename, status: 'error', reason: err.message });
  }
}

await browser.close();

// Summary
const ok = results.filter(r => r.status === 'ok').length;
console.log(`\nDone: ${ok}/${results.length} files downloaded to ${outdir}`);
process.exit(ok === results.length ? 0 : 1);

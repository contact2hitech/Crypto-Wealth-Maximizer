import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

// Locate Python executable (virtualenv or system)
function findPythonExe() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const venvWin = path.join(REPO_ROOT, "venv", "Scripts", "python.exe");
  if (fs.existsSync(venvWin)) return venvWin;
  const venvPosix = path.join(REPO_ROOT, "venv", "bin", "python");
  if (fs.existsSync(venvPosix)) return venvPosix;
  return process.platform === "win32" ? "python.exe" : "python3";
}

// Locate Edge or Chrome browser executable
function findBrowserExe() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Could not find Edge or Chrome executable. Set EDGE_PATH or CHROME_PATH environment variable.");
}

async function waitForHttp(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startBackend(pythonExe) {
  return spawn(
    pythonExe,
    [
      "-m",
      "uvicorn",
      "backend.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
      "--log-level",
      "warning",
    ],
    { cwd: REPO_ROOT, stdio: "pipe" }
  );
}

function startFrontend() {
  const cmd = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/c", "npm --prefix frontend run dev -- --port 3000"]
      : ["--prefix", "frontend", "run", "dev", "--", "--port", "3000"];

  return spawn(cmd, args, {
    cwd: REPO_ROOT,
    stdio: "pipe",
  });
}

async function stopProc(proc) {
  if (!proc || proc.killed || proc.exitCode !== null) return;
  if (process.platform === "win32" && proc.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
  } else {
    proc.kill("SIGTERM");
  }
}

let backendProc = null;
let frontendProc = null;
let browser = null;

try {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const pythonExe = findPythonExe();
  const browserExe = findBrowserExe();
  console.log(`Using Python: ${pythonExe}`);
  console.log(`Using Browser: ${browserExe}`);

  backendProc = startBackend(pythonExe);
  backendProc.stdout?.on("data", (d) => console.log("[backend stdout]", d.toString().trim()));
  backendProc.stderr?.on("data", (d) => console.error("[backend stderr]", d.toString().trim()));

  frontendProc = startFrontend();
  frontendProc.stdout?.on("data", (d) => console.log("[frontend stdout]", d.toString().trim()));
  frontendProc.stderr?.on("data", (d) => console.error("[frontend stderr]", d.toString().trim()));

  await waitForHttp("http://127.0.0.1:8000/api/health", 45000);
  await waitForHttp("http://localhost:3000/dashboard", 60000);
  console.log("Servers ready for Phase 3 integration test.");

  browser = await chromium.launch({
    executablePath: browserExe,
    headless: true,
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  let healthCalls = 0;

  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("request", (req) => {
    if (req.url().includes("/api/health")) {
      healthCalls += 1;
      console.log(`  [health #${healthCalls}] ${new Date().toISOString()}`);
    }
  });

  // 1. Dashboard verification
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  await page.getByText("API Connected").first().waitFor({ timeout: 20000 });
  await page.getByText("$585,970.46").first().waitFor({ timeout: 30000 });

  const dashboardText = await page.locator("main").innerText();
  for (const expected of [
    "$1,480.00",
    "$585,970.46",
    "39,492.60%",
    "81.89%",
    "-69.94%",
    "68.43%",
    "1.21",
    "95 / 1,830",
    "Buy & hold: Bitcoin",
    "$152,438.67",
    "Buy & hold: Ethereum",
    "Buy & hold: Solana",
  ]) {
    assert.ok(dashboardText.includes(expected), `Dashboard missing expected metric: ${expected}`);
  }

  // Verify Recharts SVG charts rendered with curves
  const dashSvgPaths = await page.locator("svg.recharts-surface path.recharts-curve").count();
  assert.ok(dashSvgPaths >= 4, `Expected >= 4 Recharts curves on Dashboard, found ${dashSvgPaths}`);

  // Test Linear/Log scale toggle on Equity chart
  await page.getByRole("button", { name: "Linear", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Log", exact: true }).click();

  // Test pagination on Switching History table
  await page.getByText("Page 1 / 10").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Next table page" }).click();
  await page.getByText("Page 2 / 10").waitFor({ timeout: 5000 });

  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "Dashboard desktop should have zero horizontal overflow"
  );
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase3_dashboard_desktop.png") });
  console.log("Dashboard KPIs, Recharts charts, scale toggle, and pagination verified.");

  // 2. Navigate to Markets and verify no duplicate /api/health calls during route transition
  await page.locator('nav[aria-label="Primary navigation"]').getByRole("link", { name: "Markets" }).click();
  await page.waitForURL("**/markets", { timeout: 30000 });
  await page.getByText("$74,496.47").first().waitFor({ timeout: 30000 });

  // Quick navigation back & forth once routes are compiled: must trigger 0 extra /api/health calls
  const healthBeforeNav = healthCalls;
  await page.locator('nav[aria-label="Primary navigation"]').getByRole("link", { name: "Dashboard" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.locator('nav[aria-label="Primary navigation"]').getByRole("link", { name: "Markets" }).click();
  await page.waitForURL("**/markets", { timeout: 15000 });
  await page.getByText("$74,496.47").first().waitFor({ timeout: 15000 });
  assert.equal(healthCalls, healthBeforeNav, "Navigating between Dashboard and Markets triggered extra /api/health request");

  const marketsText = await page.locator("main").innerText();
  for (const expected of [
    "$74,496.47",
    "$2,119.10",
    "$86.88",
    "2020-04-10",
    "3,653",
    "2,405",
    "1,248",
    "Ethereum history prior to 2017-11-09",
  ]) {
    assert.ok(marketsText.includes(expected), `Markets missing expected value: ${expected}`);
  }

  const marketsSvgPaths = await page.locator("svg.recharts-surface path.recharts-curve").count();
  assert.ok(marketsSvgPaths >= 9, `Expected >= 9 Recharts curves across 3 Markets charts, found ${marketsSvgPaths}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase3_markets_desktop.png") });

  // Test Date-Range Preset Filtering ("Test Window (2025-2026)")
  await page.getByRole("button", { name: /Test Window/i }).click();
  await page.getByText(/2025-01-01 to 2026-11-09 \(678 days\)/).waitFor({ timeout: 20000 });
  console.log("Markets date-range preset filtering (2025-01-01..2026-11-09, 678 days) verified.");

  // Test invalid date-range client validation
  await page.fill("#markets-start-date", "2025-06-01");
  await page.fill("#markets-end-date", "2025-01-01");
  await page.getByRole("button", { name: "Apply Range" }).click();
  await page.getByText("Start date must be on or before end date.").waitFor({ timeout: 5000 });

  // Test Reset back to full range
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByText(/2016-11-09 to 2026-11-09 \(3,653 days\)/).waitFor({ timeout: 20000 });
  console.log("Markets invalid-range guard and Reset verified.");

  // 3. Mobile responsiveness checks (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "Markets mobile should have zero horizontal overflow"
  );
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase3_markets_mobile.png") });

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("$585,970.46").first().waitFor({ timeout: 30000 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "Dashboard mobile should have zero horizontal overflow"
  );
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase3_dashboard_mobile.png") });

  assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join("; ")}`);
  assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join("; ")}`);
  console.log("ALL PHASE 3 PLAYWRIGHT INTEGRATION CHECKS PASSED WITH 0 CONSOLE/PAGE ERRORS.");
} finally {
  await browser?.close();
  await stopProc(backendProc);
  await stopProc(frontendProc);
}


import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
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

function checkPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function waitForHttp(url, checkExitFn, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (checkExitFn) {
      const exitErr = checkExitFn();
      if (exitErr) throw new Error(exitErr);
    }
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

  const port8000Free = await checkPortAvailable(8000);
  if (!port8000Free) {
    throw new Error(
      "Port 8000 is already in use. Ensure all stale backend instances are killed before running E2E tests."
    );
  }
  const port3000Free = await checkPortAvailable(3000);
  if (!port3000Free) {
    throw new Error(
      "Port 3000 is already in use. Ensure all stale Next.js dev instances are killed before running E2E tests."
    );
  }

  const pythonExe = findPythonExe();
  const browserExe = findBrowserExe();
  console.log(`Using Python: ${pythonExe}`);
  console.log(`Using Browser: ${browserExe}`);

  let backendExitReason = null;
  let frontendExitReason = null;

  backendProc = startBackend(pythonExe);
  backendProc.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      backendExitReason = `Backend process exited prematurely with code ${code} signal ${signal}`;
    }
  });
  backendProc.stdout?.on("data", (d) => console.log("[backend stdout]", d.toString().trim()));
  backendProc.stderr?.on("data", (d) => console.error("[backend stderr]", d.toString().trim()));

  frontendProc = startFrontend();
  frontendProc.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      frontendExitReason = `Frontend process exited prematurely with code ${code} signal ${signal}`;
    }
  });
  frontendProc.stdout?.on("data", (d) => console.log("[frontend stdout]", d.toString().trim()));
  frontendProc.stderr?.on("data", (d) => console.error("[frontend stderr]", d.toString().trim()));

  await waitForHttp("http://127.0.0.1:8000/api/health", () => backendExitReason, 30000);
  await waitForHttp("http://localhost:3000/dashboard", () => frontendExitReason ?? backendExitReason, 60000);
  console.log("Servers ready for Phase 4 integration tests.");

  browser = await chromium.launch({
    executablePath: browserExe,
    headless: true,
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

  // 1. STRATEGY LAB VERIFICATION (/strategy-lab)
  console.log("Verifying /strategy-lab...");
  await page.goto("http://localhost:3000/strategy-lab", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("API Connected").first().waitFor({ timeout: 20000 });
  await page.getByText("Strategy Lab").first().waitFor({ timeout: 20000 });
  await page.getByText("Phase 4 Active").first().waitFor({ timeout: 20000 });

  // Verify KPI Grid
  await page.getByText("$585,970.46").first().waitFor({ timeout: 35000 });
  await page.getByText("81.89%").first().waitFor({ timeout: 15000 });
  await page.getByText("-69.94%").first().waitFor({ timeout: 15000 });

  // Verify Recharts curves rendered
  const curves = await page.locator(".recharts-curve").count();
  assert.ok(curves >= 3, `Expected at least 3 Recharts curves on Strategy Lab, found ${curves}`);

  // Test Sub-Workflow: 4 Protection Modes Comparison Tab
  console.log("  Testing 4 Protection Modes tab...");
  await page.getByRole("button", { name: "4 Protection Modes Comparison" }).click();
  await page.getByText("A – Cash filter only").first().waitFor({ timeout: 45000 });
  await page.getByText("C – Combined protection").first().waitFor({ timeout: 20000 });

  // Test Sub-Workflow: Practical Strategies Tab
  console.log("  Testing Practical Strategies A/B/C tab...");
  await page.getByRole("button", { name: "Practical Strategies A / B / C" }).click();
  await page.getByText("Practical Strategy Baselines").first().waitFor({ timeout: 45000 });
  await page.locator("table").getByText("A: 90-day momentum").first().waitFor({ timeout: 35000 });

  // Test Sub-Workflow: Perfect-Hindsight Tab & Non-Investable Warning
  console.log("  Testing Perfect-Hindsight Upper Bound tab & disclaimer...");
  await page.getByRole("button", { name: "Perfect-Hindsight Upper Bound" }).click();
  await page.getByText("PERFECT HINDSIGHT — NON-INVESTABLE UPPER BOUND").first().waitFor({ timeout: 45000 });
  await page.getByText("is_hindsight_upper_bound: true").first().waitFor({ timeout: 20000 });
  await page.getByText("is_investable: false").first().waitFor({ timeout: 20000 });
  await page.getByText("K = 5").first().waitFor({ timeout: 20000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase4_strategy_lab_desktop.png"), fullPage: true });
  console.log("Strategy Lab desktop verified.");

  // 2. RISK LAB VERIFICATION (/risk-lab)
  console.log("Verifying /risk-lab...");
  await page.goto("http://localhost:3000/risk-lab", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Risk Analytics & Protection Lab").first().waitFor({ timeout: 30000 });
  await page.getByText("Critical Risk Disclosure: Daily-Close Stops & Intraday Gap Risk").first().waitFor({ timeout: 20000 });

  // Verify KPIs
  await page.getByText("-69.94%").first().waitFor({ timeout: 45000 });
  await page.getByText("68.43%").first().waitFor({ timeout: 20000 });
  await page.getByText("1.21").first().waitFor({ timeout: 20000 });

  // Verify Recharts Area Chart rendered
  const areas = await page.locator(".recharts-area").count();
  assert.ok(areas >= 1, `Expected at least 1 underwater drawdown area, found ${areas}`);

  // Verify Tables: Event Summary, Exits & Trace
  await page.getByText("Protection & Allocation Event Count Summary").first().waitFor({ timeout: 20000 });
  await page.getByText("Drawdown Protection Exits & Gap Overshoot Analysis").first().waitFor({ timeout: 20000 });
  await page.getByText("Daily Drawdown Execution Trace").first().waitFor({ timeout: 20000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase4_risk_lab_desktop.png"), fullPage: true });
  console.log("Risk Lab desktop verified.");

  // 3. ROBUSTNESS VERIFICATION (/robustness)
  console.log("Verifying /robustness...");
  await page.goto("http://localhost:3000/robustness", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Robustness & Walk-Forward Research").first().waitFor({ timeout: 30000 });

  // Verify Honest Test-Period Research Banner
  await page.getByText("Strict Research Honesty: Out-of-Sample Test Period Deterioration").first().waitFor({ timeout: 20000 });
  await page.getByText("-24.96%").first().waitFor({ timeout: 45000 });
  await page.getByText("-0.46").first().waitFor({ timeout: 20000 });

  // Verify Walk-Forward Partition Rows
  await page.getByText("Development").first().waitFor({ timeout: 20000 });
  await page.getByText("Validation").first().waitFor({ timeout: 20000 });
  await page.getByText("Test").first().waitFor({ timeout: 20000 });
  await page.getByText("Held-Out Out-of-Sample").first().waitFor({ timeout: 20000 });

  // Verify Causal Market Regimes & Attribution Tables
  await page.getByText("Causal Bitcoin Market Regime Performance").first().waitFor({ timeout: 20000 });
  await page.getByText("Asset Exposure & Return Attribution").first().waitFor({ timeout: 20000 });

  // Verify 3x3 Parameter Sensitivity Grid
  await page.getByText("Predeclared 3×3 Parameter Sensitivity Grid").first().waitFor({ timeout: 20000 });
  await page.getByText("3 Strategies (A, B, C) × 3 Drawdown Stops (15%, 20%, 25%)").first().waitFor({ timeout: 20000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "phase4_robustness_desktop.png"), fullPage: true });
  console.log("Robustness desktop verified.");

  // 4. MOBILE VIEWPORT VERIFICATION (390 x 844)
  console.log("Verifying mobile viewports...");
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto("http://localhost:3000/strategy-lab", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobilePage.getByRole("heading", { name: "Strategy Lab", level: 1 }).waitFor({ timeout: 20000 });
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "phase4_strategy_lab_mobile.png"), fullPage: true });

  await mobilePage.goto("http://localhost:3000/risk-lab", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobilePage.getByRole("heading", { name: "Risk Analytics & Protection Lab", level: 1 }).waitFor({ timeout: 20000 });
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "phase4_risk_lab_mobile.png"), fullPage: true });

  await mobilePage.goto("http://localhost:3000/robustness", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobilePage.getByRole("heading", { name: "Robustness & Walk-Forward Research", level: 1 }).waitFor({ timeout: 20000 });
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "phase4_robustness_mobile.png"), fullPage: true });
  await mobileContext.close();

  // 5. ASSERT ZERO CONSOLE OR PAGE ERRORS
  console.log(`Page errors: ${pageErrors.length}, Console errors: ${consoleErrors.length}`);
  if (pageErrors.length > 0) {
    console.error("PAGE ERRORS:", pageErrors);
  }
  if (consoleErrors.length > 0) {
    console.error("CONSOLE ERRORS:", consoleErrors);
  }
  assert.equal(pageErrors.length, 0, "Encountered uncaught page errors");
  assert.equal(consoleErrors.length, 0, "Encountered browser console error logs");

  console.log("ALL PHASE 4 PLAYWRIGHT E2E CHECKS PASSED WITH 0 CONSOLE/PAGE ERRORS.");
} finally {
  if (browser) await browser.close();
  await stopProc(frontendProc);
  await stopProc(backendProc);

  // Allow port release
  await new Promise((r) => setTimeout(r, 2000));
}


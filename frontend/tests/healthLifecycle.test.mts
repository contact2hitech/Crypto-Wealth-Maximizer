import test from "node:test";
import assert from "node:assert/strict";
import {
  HealthCheckCoordinator,
  type HealthStateSnapshot,
} from "../lib/api/healthLifecycle.ts";
import type { HealthResponse } from "../types/api.ts";

function makeHealth(overrides: Partial<HealthResponse> = {}): HealthResponse {
  return {
    status: "ok",
    service: "Crypto Wealth Maximizer API",
    version: "2.0.0-alpha.1",
    app_env: "development",
    engine_source_of_truth: "python",
    python_version: "3.13.9",
    timestamp_utc: "2026-11-12T00:00:00Z",
    dataset: {
      path_relative: "data/crypto_daily_prices.csv",
      row_count: 3653,
      duplicate_dates: 0,
      start_date: "2016-11-09",
      end_date: "2026-11-09",
      assets_available: ["Bitcoin", "Ethereum", "Solana"],
      missing_pre_launch_sol_days: 1248,
      last_modified_utc: "2026-11-11T07:13:30Z",
      valid: true,
    },
    ...overrides,
  };
}

function createSnapshotHolder() {
  let state: HealthStateSnapshot = {
    status: "checking",
    health: null,
    errorMessage: null,
    lastCheckedAt: null,
  };
  return {
    get: () => state,
    update: (updater: (prev: HealthStateSnapshot) => HealthStateSnapshot) => {
      state = updater(state);
    },
  };
}

test("React Strict Mode setup -> cleanup -> setup aborts req 1 and completes req 2 cleanly", async () => {
  const holder = createSnapshotHolder();
  const signals: AbortSignal[] = [];
  const resolvers: Array<(value: HealthResponse) => void> = [];

  const coordinator = new HealthCheckCoordinator({
    fetcher: (signal) => {
      signals.push(signal);
      return new Promise<HealthResponse>((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        );
        resolvers.push(resolve);
      });
    },
    isAbortError: (err) => err instanceof DOMException && err.name === "AbortError",
    onStateChange: holder.update,
    nowIso: () => "2026-11-12T12:00:00Z",
  });

  // 1. Strict Mode initial mount
  coordinator.activate();
  const p1 = coordinator.checkHealth();
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, false);

  // 2. Strict Mode simulated cleanup
  coordinator.cleanup();
  assert.equal(signals[0].aborted, true);

  // 3. Strict Mode remount starts fresh request immediately (does not reuse aborted p1)
  coordinator.activate();
  const p2 = coordinator.checkHealth();
  assert.equal(signals.length, 2);
  assert.notEqual(p1, p2);
  assert.equal(signals[1].aborted, false);

  // Resolve request 2 -> status becomes connected
  resolvers[1](makeHealth());
  await Promise.allSettled([p1, p2]);

  assert.equal(holder.get().status, "connected");
  assert.equal(holder.get().health?.dataset.row_count, 3653);
});

test("Stale request finally/resolution cannot clobber newer active request or state", async () => {
  const holder = createSnapshotHolder();
  let callIndex = 0;
  const deferred: Array<{
    resolve: (v: HealthResponse) => void;
    reject: (e: unknown) => void;
  }> = [];

  const coordinator = new HealthCheckCoordinator({
    fetcher: () =>
      new Promise<HealthResponse>((resolve, reject) => {
        callIndex += 1;
        deferred.push({ resolve, reject });
      }),
    isAbortError: () => false,
    onStateChange: holder.update,
    nowIso: () => "2026-11-12T12:00:00Z",
  });

  // Start req 1, cleanup (aborted without rejecting immediately), remount and start req 2.
  coordinator.activate();
  const p1 = coordinator.checkHealth();
  coordinator.cleanup();
  coordinator.activate();
  const p2 = coordinator.checkHealth();
  assert.equal(callIndex, 2);

  // Even if req 1 resolves/rejects late BEFORE req 2 finishes, req 2 must stay deduplicated
  // and req 1 must not overwrite state.
  deferred[0].reject(new Error("Stale failure"));
  await p1;

  // Simultaneous call while req 2 is still in flight must reuse p2 (not start req 3).
  const p2Dup = coordinator.checkHealth();
  assert.equal(p2Dup, p2);
  assert.equal(callIndex, 2);
  assert.equal(holder.get().status, "checking");

  // Resolve req 2 -> status becomes connected.
  deferred[1].resolve(makeHealth());
  await p2;
  assert.equal(holder.get().status, "connected");
});

test("Deduplicates simultaneous calls and transitions connected -> offline -> checking -> connected on retry", async () => {
  const holder = createSnapshotHolder();
  let mode: "ok" | "degraded" | "offline" = "ok";
  let fetchCount = 0;

  const coordinator = new HealthCheckCoordinator({
    fetcher: async () => {
      fetchCount += 1;
      if (mode === "offline") {
        throw new Error("Connection refused");
      }
      if (mode === "degraded") {
        return makeHealth({ status: "degraded" });
      }
      return makeHealth({ status: "ok" });
    },
    isAbortError: () => false,
    onStateChange: holder.update,
    nowIso: () => "2026-11-12T12:00:00Z",
  });

  coordinator.activate();
  const a = coordinator.checkHealth();
  const b = coordinator.checkHealth();
  assert.equal(a, b);
  await a;
  assert.equal(fetchCount, 1);
  assert.equal(holder.get().status, "connected");

  mode = "degraded";
  await coordinator.checkHealth();
  assert.equal(holder.get().status, "degraded");

  mode = "offline";
  await coordinator.checkHealth();
  assert.equal(holder.get().status, "offline");
  assert.equal(holder.get().health, null);
  assert.equal(holder.get().errorMessage, "Connection refused");

  mode = "ok";
  const retryPromise = coordinator.checkHealth();
  assert.equal(holder.get().status, "checking");
  await retryPromise;
  assert.equal(holder.get().status, "connected");
});

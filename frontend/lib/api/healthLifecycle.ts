import type { HealthResponse } from "@/types/api";

export type HealthConnectionStatus = "checking" | "connected" | "degraded" | "offline";

export interface HealthStateSnapshot {
  status: HealthConnectionStatus;
  health: HealthResponse | null;
  errorMessage: string | null;
  lastCheckedAt: string | null;
}

interface ActiveHealthRequest {
  id: number;
  promise: Promise<void>;
  controller: AbortController;
}

export interface HealthLifecycleOptions {
  fetcher: (signal: AbortSignal) => Promise<HealthResponse>;
  isAbortError: (err: unknown) => boolean;
  onStateChange: (updater: (prev: HealthStateSnapshot) => HealthStateSnapshot) => void;
  nowIso?: () => string;
}

/**
 * Race-safe coordinator for API health checks.
 * Supports React Strict Mode setup/cleanup/setup cycles, deduplicates simultaneous
 * non-aborted calls, and blocks stale or aborted requests from mutating newer state.
 */
export class HealthCheckCoordinator {
  private readonly fetcher: (signal: AbortSignal) => Promise<HealthResponse>;
  private readonly isAbortError: (err: unknown) => boolean;
  private readonly onStateChange: (
    updater: (prev: HealthStateSnapshot) => HealthStateSnapshot
  ) => void;
  private readonly nowIso: () => string;

  private activeRequest: ActiveHealthRequest | null = null;
  private latestRequestId = 0;
  private disposed = false;

  constructor(options: HealthLifecycleOptions) {
    this.fetcher = options.fetcher;
    this.isAbortError = options.isAbortError;
    this.onStateChange = options.onStateChange;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
  }

  activate(): void {
    this.disposed = false;
  }

  cleanup(): void {
    this.disposed = true;
    // Advance request sequence so any still-settling response is recognized as stale.
    this.latestRequestId += 1;
    const pending = this.activeRequest;
    if (pending) {
      this.activeRequest = null;
      pending.controller.abort();
    }
  }

  checkHealth(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    if (this.activeRequest && !this.activeRequest.controller.signal.aborted) {
      return this.activeRequest.promise;
    }

    const requestId = ++this.latestRequestId;
    const controller = new AbortController();

    this.onStateChange((prev) => ({
      ...prev,
      status: prev.status === "connected" ? "connected" : "checking",
      errorMessage: null,
    }));

    const promise = (async () => {
      try {
        const data = await this.fetcher(controller.signal);
        if (
          this.disposed ||
          this.latestRequestId !== requestId ||
          controller.signal.aborted
        ) {
          return;
        }
        const nextStatus: HealthConnectionStatus =
          data.status === "ok" && data.dataset.valid ? "connected" : "degraded";
        this.onStateChange(() => ({
          status: nextStatus,
          health: data,
          errorMessage: null,
          lastCheckedAt: this.nowIso(),
        }));
      } catch (err) {
        if (
          this.disposed ||
          this.latestRequestId !== requestId ||
          controller.signal.aborted ||
          this.isAbortError(err)
        ) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Backend health check failed.";
        this.onStateChange(() => ({
          status: "offline",
          health: null,
          errorMessage: message,
          lastCheckedAt: this.nowIso(),
        }));
      } finally {
        // Only clear the active slot if this exact request still owns it.
        if (this.activeRequest?.id === requestId) {
          this.activeRequest = null;
        }
      }
    })();

    this.activeRequest = { id: requestId, promise, controller };
    return promise;
  }
}

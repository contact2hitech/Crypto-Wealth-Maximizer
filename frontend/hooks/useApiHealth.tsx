"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiClientError, apiClient } from "@/lib/api";
import {
  HealthCheckCoordinator,
  type HealthConnectionStatus,
  type HealthStateSnapshot,
} from "@/lib/api/healthLifecycle";
import type { HealthResponse } from "@/types/api";

export type { HealthConnectionStatus };

export interface ApiHealthContextValue {
  status: HealthConnectionStatus;
  health: HealthResponse | null;
  errorMessage: string | null;
  lastCheckedAt: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 20_000;

const ApiHealthContext = createContext<ApiHealthContextValue | null>(null);

export function ApiHealthProvider({
  children,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  children: React.ReactNode;
  pollIntervalMs?: number;
}) {
  const [snapshot, setSnapshot] = useState<HealthStateSnapshot>({
    status: "checking",
    health: null,
    errorMessage: null,
    lastCheckedAt: null,
  });

  const coordinatorRef = useRef<HealthCheckCoordinator | null>(null);

  const ensureCoordinator = useCallback((): HealthCheckCoordinator => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = new HealthCheckCoordinator({
        fetcher: (signal) => apiClient.getHealth(signal),
        isAbortError: (err) =>
          (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") ||
          (err instanceof DOMException && err.name === "AbortError"),
        onStateChange: (updater) => setSnapshot(updater),
      });
    }
    return coordinatorRef.current;
  }, []);

  const refresh = useCallback(() => {
    return ensureCoordinator().checkHealth();
  }, [ensureCoordinator]);

  useEffect(() => {
    const coordinator = ensureCoordinator();
    coordinator.activate();
    void coordinator.checkHealth();

    const intervalId =
      pollIntervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") {
              void coordinator.checkHealth();
            }
          }, pollIntervalMs)
        : undefined;

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      coordinator.cleanup();
    };
  }, [ensureCoordinator, pollIntervalMs]);

  return (
    <ApiHealthContext.Provider
      value={{
        status: snapshot.status,
        health: snapshot.health,
        errorMessage: snapshot.errorMessage,
        lastCheckedAt: snapshot.lastCheckedAt,
        refresh,
      }}
    >
      {children}
    </ApiHealthContext.Provider>
  );
}

export function useApiHealth(): ApiHealthContextValue {
  const ctx = useContext(ApiHealthContext);
  if (!ctx) {
    throw new Error("useApiHealth must be used within ApiHealthProvider.");
  }
  return ctx;
}

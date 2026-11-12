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
import type { HealthResponse } from "@/types/api";

export type HealthConnectionStatus = "checking" | "connected" | "degraded" | "offline";

export interface ApiHealthContextValue {
  status: HealthConnectionStatus;
  health: HealthResponse | null;
  errorMessage: string | null;
  lastCheckedAt: string | null;
  refresh: () => Promise<void>;
}

const ApiHealthContext = createContext<ApiHealthContextValue | null>(null);

export function ApiHealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HealthConnectionStatus>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus((prev) => (prev === "connected" ? prev : "checking"));
    setErrorMessage(null);

    const task = (async () => {
      try {
        const data = await apiClient.getHealth(controller.signal);
        setHealth(data);
        setStatus(data.status === "ok" && data.dataset.valid ? "connected" : "degraded");
        setLastCheckedAt(new Date().toISOString());
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") {
          return;
        }
        setHealth(null);
        setStatus("offline");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Backend health check failed."
        );
        setLastCheckedAt(new Date().toISOString());
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    void checkHealth();
    return () => {
      abortRef.current?.abort();
    };
  }, [checkHealth]);

  return (
    <ApiHealthContext.Provider
      value={{
        status,
        health,
        errorMessage,
        lastCheckedAt,
        refresh: checkHealth,
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


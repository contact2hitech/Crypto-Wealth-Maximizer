import { getApiBaseUrl } from "@/lib/api/config";
import type { ApiErrorEnvelope } from "@/types/api";

export const STANDARD_TIMEOUT_MS = 60_000;
export const HEAVY_COMPUTATION_TIMEOUT_MS = 90_000;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly isTimeout: boolean;
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
      isTimeout?: boolean;
      isNetworkError?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "API_ERROR";
    this.details = options.details ?? {};
    this.isTimeout = options.isTimeout ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function mergeSignals(
  externalSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal
): AbortSignal {
  if (!externalSignal) return timeoutSignal;
  const controller = new AbortController();
  const abortFrom = (source: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };
  if (externalSignal.aborted) abortFrom(externalSignal);
  if (timeoutSignal.aborted) abortFrom(timeoutSignal);
  externalSignal.addEventListener("abort", () => abortFrom(externalSignal), { once: true });
  timeoutSignal.addEventListener("abort", () => abortFrom(timeoutSignal), { once: true });
  return controller.signal;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    timeoutMs = STANDARD_TIMEOUT_MS,
    signal: externalSignal,
  } = options;

  const url = buildUrl(path, query);
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error(`Request timed out after ${timeoutMs} ms`));
  }, timeoutMs);

  const combinedSignal = mergeSignals(externalSignal, timeoutController.signal);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: combinedSignal,
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const parsed = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (
        isJson &&
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed
      ) {
        const envelope = parsed as ApiErrorEnvelope;
        throw new ApiClientError(
          envelope.error.message || `Request failed with status ${response.status}`,
          {
            status: response.status,
            code: envelope.error.code || `HTTP_${response.status}`,
            details: envelope.error.details ?? {},
          }
        );
      }
      throw new ApiClientError(
        typeof parsed === "string" && parsed
          ? parsed
          : `Request failed with status ${response.status}`,
        {
          status: response.status,
          code: `HTTP_${response.status}`,
        }
      );
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    if (timeoutController.signal.aborted && !externalSignal?.aborted) {
      throw new ApiClientError(
        `Backend calculation timed out after ${Math.round(timeoutMs / 1000)}s.`,
        { code: "REQUEST_TIMEOUT", isTimeout: true }
      );
    }
    if (externalSignal?.aborted) {
      throw new ApiClientError("Request was cancelled.", {
        code: "REQUEST_ABORTED",
      });
    }
    const message =
      err instanceof Error
        ? err.message
        : "Unable to reach the FastAPI backend service.";
    throw new ApiClientError(message, {
      code: "NETWORK_ERROR",
      isNetworkError: true,
    });
  } finally {
    clearTimeout(timer);
  }
}


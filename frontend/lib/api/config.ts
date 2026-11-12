const DEFAULT_DEV_API_BASE_URL = "http://127.0.0.1:8000";

/**
 * Resolve the configured backend API base URL from NEXT_PUBLIC_API_BASE_URL.
 * Never hardcode production service URLs or secrets.
 */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured for production deployment."
    );
  }
  return DEFAULT_DEV_API_BASE_URL;
}


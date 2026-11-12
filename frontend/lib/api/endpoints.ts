import {
  HEAVY_COMPUTATION_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  apiRequest,
} from "@/lib/api/client";
import { getApiBaseUrl } from "@/lib/api/config";
import type {
  ConstrainedBacktestRequest,
  ConstrainedBacktestResponse,
  HealthResponse,
  HindsightOptimizerRequest,
  HindsightOptimizerResponse,
  MarketPricesResponse,
  MarketSummaryResponse,
  PracticalBacktestRequest,
  PracticalBacktestResponse,
  ProtectionCompareRequest,
  ProtectionCompareResponse,
  ReportsSummaryResponse,
  RiskProtectionRequest,
  RiskProtectionResponse,
  RobustnessAnalyzeRequest,
  RobustnessAnalyzeResponse,
} from "@/types/api";

export const apiClient = {
  getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    return apiRequest<HealthResponse>("/api/health", {
      method: "GET",
      timeoutMs: STANDARD_TIMEOUT_MS,
      signal,
    });
  },

  getMarketPrices(
    params: {
      start_date?: string;
      end_date?: string;
      initial_capital?: number;
    } = {},
    signal?: AbortSignal
  ): Promise<MarketPricesResponse> {
    return apiRequest<MarketPricesResponse>("/api/markets/prices", {
      method: "GET",
      query: params,
      timeoutMs: STANDARD_TIMEOUT_MS,
      signal,
    });
  },

  getMarketSummary(
    params: {
      start_date?: string;
      end_date?: string;
    } = {},
    signal?: AbortSignal
  ): Promise<MarketSummaryResponse> {
    return apiRequest<MarketSummaryResponse>("/api/markets/summary", {
      method: "GET",
      query: params,
      timeoutMs: STANDARD_TIMEOUT_MS,
      signal,
    });
  },

  runConstrainedBacktest(
    payload: Partial<ConstrainedBacktestRequest> = {},
    signal?: AbortSignal
  ): Promise<ConstrainedBacktestResponse> {
    return apiRequest<ConstrainedBacktestResponse>("/api/backtest/run", {
      method: "POST",
      body: payload,
      timeoutMs: HEAVY_COMPUTATION_TIMEOUT_MS,
      signal,
    });
  },

  compareProtectionModes(
    payload: Partial<ProtectionCompareRequest> = {},
    signal?: AbortSignal
  ): Promise<ProtectionCompareResponse> {
    return apiRequest<ProtectionCompareResponse>("/api/backtest/compare", {
      method: "POST",
      body: payload,
      timeoutMs: HEAVY_COMPUTATION_TIMEOUT_MS,
      signal,
    });
  },

  runPracticalStrategies(
    payload: Partial<PracticalBacktestRequest> = {},
    signal?: AbortSignal
  ): Promise<PracticalBacktestResponse> {
    return apiRequest<PracticalBacktestResponse>("/api/backtest/practical", {
      method: "POST",
      body: payload,
      timeoutMs: HEAVY_COMPUTATION_TIMEOUT_MS,
      signal,
    });
  },

  runHindsightOptimizer(
    payload: Partial<HindsightOptimizerRequest> = {},
    signal?: AbortSignal
  ): Promise<HindsightOptimizerResponse> {
    return apiRequest<HindsightOptimizerResponse>("/api/backtest/hindsight", {
      method: "POST",
      body: payload,
      timeoutMs: HEAVY_COMPUTATION_TIMEOUT_MS,
      signal,
    });
  },

  analyzeRiskProtection(
    payload: Partial<RiskProtectionRequest> = {},
    signal?: AbortSignal
  ): Promise<RiskProtectionResponse> {
    return apiRequest<RiskProtectionResponse>("/api/risk/protection", {
      method: "POST",
      body: payload,
      timeoutMs: HEAVY_COMPUTATION_TIMEOUT_MS,
      signal,
    });
  },

  analyzeRobustness(
    payload: Partial<RobustnessAnalyzeRequest> = {},
    signal?: AbortSignal
  ): Promise<RobustnessAnalyzeResponse> {
    return apiRequest<RobustnessAnalyzeResponse>("/api/robustness/analyze", {
      method: "POST",
      body: payload,
      timeoutMs: HEAVY_COMPUTATION_TIMEOUT_MS,
      signal,
    });
  },

  getReportsSummary(signal?: AbortSignal): Promise<ReportsSummaryResponse> {
    return apiRequest<ReportsSummaryResponse>("/api/reports/summary", {
      method: "GET",
      timeoutMs: STANDARD_TIMEOUT_MS,
      signal,
    });
  },

  getResearchReportDownloadUrl(): string {
    return `${getApiBaseUrl()}/api/reports/download/research-report`;
  },

  getReleaseNotesDownloadUrl(): string {
    return `${getApiBaseUrl()}/api/reports/download/release-notes`;
  },
};


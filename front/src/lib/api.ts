'use client';

import { getAccessToken, logout } from './auth';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper function to format FastAPI validation errors
function formatValidationErrors(details: any[], defaultMessage: string): string {
  const validationErrors = details
    .map((err: any) => {
      const field = err.loc ? err.loc.slice(1).join('.') : 'unknown';
      return `${field}: ${err.msg}`;
    })
    .join('; ');
  return validationErrors || defaultMessage;
}

// Helper function to extract detail from error details
function extractDetailFromErrorDetails(details: any): string | null {
  if (typeof details === 'object' && 'detail' in details) {
    const detail = details.detail;
    if (typeof detail === 'string') {
      return detail;
    }
  } else if (typeof details === 'string') {
    return details;
  }
  return null;
}

// Helper function to handle 422 validation errors
function handleValidationError(error: ApiError): string | null {
  if (error.status !== 422 || !error.details) {
    return null;
  }

  if (Array.isArray(error.details)) {
    return formatValidationErrors(error.details, error.message);
  }

  if (typeof error.details === 'string') {
    return error.details;
  }

  return null;
}

// Utility function to format API errors for user display
export function formatApiError(error: unknown, defaultMessage: string): string {
  if (error instanceof ApiError) {
    // Handle auth errors
    if (error.status === 401) {
      logout();
      return 'Your session has expired. Please sign in again.';
    }

    if (error.status === 403) {
      return 'You need administrator permissions to perform this action.';
    }

    // Try handling as validation error first
    const validationError = handleValidationError(error);
    if (validationError) {
      return validationError;
    }

    // Try extracting detail from error details
    if (error.details) {
      const detail = extractDetailFromErrorDetails(error.details);
      if (detail) {
        return detail;
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message || defaultMessage;
  }

  return defaultMessage;
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || errorData.detail || `HTTP ${response.status}`;
      console.error(`API Error [${response.status}] ${endpoint}:`, {
        url,
        status: response.status,
        message: errorMessage,
        data: errorData,
        requestBody: options.body,
      });

      // Auto-logout on 401
      if (response.status === 401) {
        logout();
      }

      throw new ApiError(
        errorMessage,
        response.status,
        errorData.detail || errorData.details || errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Network error';
    console.error('Fetch error:', message, error);
    throw new ApiError(message, 0);
  }
}

// API Types (matching backend schemas)
export interface EvaluationProgramRead {
  id: string;
  organization_context: string;
  time_period: string; // ISO datetime string from backend
  responsible_team: string;
  validity_period?: number;
  reevaluation_triggers?: string[];
  created_at: string;
  updated_at: string;
}

export interface GoalRead {
  id: string;
  purpose: string;
  focus: string;
  viewpoint: string;
  context?: string;
  evaluation_program_id: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluationCriterionRead {
  id: string;
  dimension: string;
  description: string;
  weight: number;
  aggregation_strategy: 'weighted_average' | 'weighted_sum_normalized' | 'direct_metric_weights' | 'custom';
  goal_id: string;
  created_at: string;
  updated_at: string;
}

export interface MetricRead {
  id: string;
  name: string;
  definition: string;
  unit: string;
  scale_type: 'nominal' | 'ordinal' | 'interval' | 'ratio';
  collection_method: 'automated' | 'manual' | 'hybrid';
  normalization_method: 'none' | 'max' | 'min';
  weight: number;
  target_value: number | null;
  direction: 'higher_is_better' | 'lower_is_better' | 'target_value';
  evaluation_criterion_id: string;
  created_at: string;
  updated_at: string;
}

export interface LLMToolConfigurationRead {
  id: string;
  tool_name: string;
  model_version: string;
  prompt_strategy: string;
  parameters: Record<string, any>;
  timestamp: string;
  total_score: number | null;
  total_score_updated_at: string | null;
  toolchain?: string;
  ide?: string;
  ide_plugins?: string[];
  conversation_history?: Array<{ role: string; content: string }>;
  skills_used?: string[];
  created_at: string;
  updated_at: string;
}

export interface MeasurementRead {
  id: string;
  value: number;
  normalized_value: number | null;
  evaluator: string;
  notes: string | null;
  llm_tool_configuration_id: string;
  metric_id: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface AggregatedScoreRead {
  id: string;
  score: number;
  component_metrics: Record<string, number>;
  criterion_id: string;
  tool_config_id: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

// API Client
export const api = {
  // Evaluation Programs
  evaluationPrograms: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<EvaluationProgramRead[]>(
        `/api/v1/domain/evaluation-programs/?skip=${skip}&limit=${limit}`
      ),
    getById: (id: string) =>
      apiFetch<EvaluationProgramRead>(`/api/v1/domain/evaluation-programs/${id}`),
    create: (data: any) =>
      apiFetch<EvaluationProgramRead>('/api/v1/domain/evaluation-programs/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<EvaluationProgramRead>(`/api/v1/domain/evaluation-programs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<void>(`/api/v1/domain/evaluation-programs/${id}`, {
        method: 'DELETE',
      }),
  },

  // Goals
  goals: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<GoalRead[]>(`/api/v1/domain/goals/?skip=${skip}&limit=${limit}`),
    getById: (id: string) =>
      apiFetch<GoalRead>(`/api/v1/domain/goals/${id}`),
    getByProgram: (programId: string) =>
      apiFetch<GoalRead[]>(`/api/v1/domain/evaluation-programs/${programId}/goals`),
    create: (data: any) =>
      apiFetch<GoalRead>('/api/v1/domain/goals/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<GoalRead>(`/api/v1/domain/goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Evaluation Criteria
  evaluationCriteria: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<EvaluationCriterionRead[]>(
        `/api/v1/domain/evaluation-criteria/?skip=${skip}&limit=${limit}`
      ),
    getById: (id: string) =>
      apiFetch<EvaluationCriterionRead>(`/api/v1/domain/evaluation-criteria/${id}`),
    getByGoal: (goalId: string) =>
      apiFetch<EvaluationCriterionRead[]>(
        `/api/v1/domain/goals/${goalId}/evaluation-criteria`
      ),
    create: (data: any) =>
      apiFetch<EvaluationCriterionRead>('/api/v1/domain/evaluation-criteria/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<EvaluationCriterionRead>(`/api/v1/domain/evaluation-criteria/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Metrics
  metrics: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<MetricRead[]>(`/api/v1/domain/metrics/?skip=${skip}&limit=${limit}`),
    getById: (id: string) =>
      apiFetch<MetricRead>(`/api/v1/domain/metrics/${id}`),
    getByCriterion: (criterionId: string) =>
      apiFetch<MetricRead[]>(
        `/api/v1/domain/evaluation-criteria/${criterionId}/metrics`
      ),
    create: (data: any) =>
      apiFetch<MetricRead>('/api/v1/domain/metrics/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<MetricRead>(`/api/v1/domain/metrics/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // LLM Tool Configurations
  llmToolConfigurations: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<LLMToolConfigurationRead[]>(
        `/api/v1/domain/llm-tool-configurations/?skip=${skip}&limit=${limit}`
      ),
    getById: (id: string) =>
      apiFetch<LLMToolConfigurationRead>(`/api/v1/domain/llm-tool-configurations/${id}`),
    getByMetric: (metricId: string) =>
      apiFetch<LLMToolConfigurationRead[]>(
        `/api/v1/domain/metrics/${metricId}/llm-tool-configurations`
      ),
    create: (data: any) =>
      apiFetch<LLMToolConfigurationRead>('/api/v1/domain/llm-tool-configurations/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<LLMToolConfigurationRead>(`/api/v1/domain/llm-tool-configurations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Measurements
  measurements: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<MeasurementRead[]>(
        `/api/v1/domain/measurements/?skip=${skip}&limit=${limit}`
      ),
    getById: (id: string) =>
      apiFetch<MeasurementRead>(`/api/v1/domain/measurements/${id}`),
    getByConfiguration: (configId: string) =>
      apiFetch<MeasurementRead[]>(
        `/api/v1/domain/llm-tool-configurations/${configId}/measurements`
      ),
    create: (data: any) =>
      apiFetch<MeasurementRead>('/api/v1/domain/measurements/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<MeasurementRead>(`/api/v1/domain/measurements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Aggregated Scores
  aggregatedScores: {
    getAll: (skip = 0, limit = 100) =>
      apiFetch<AggregatedScoreRead[]>(
        `/api/v1/domain/aggregated-scores/?skip=${skip}&limit=${limit}`
      ),
    getById: (id: string) =>
      apiFetch<AggregatedScoreRead>(`/api/v1/domain/aggregated-scores/${id}`),
    getByCriterion: (criterionId: string) =>
      apiFetch<AggregatedScoreRead[]>(
        `/api/v1/domain/evaluation-criteria/${criterionId}/aggregated-scores`
      ),
    getByConfiguration: (configId: string) =>
      apiFetch<AggregatedScoreRead[]>(
        `/api/v1/domain/llm-tool-configurations/${configId}/aggregated-scores`
      ),
    create: (data: any) =>
      apiFetch<AggregatedScoreRead>('/api/v1/domain/aggregated-scores/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiFetch<AggregatedScoreRead>(`/api/v1/domain/aggregated-scores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    recalculateForCriterion: (criterionId: string) =>
      apiFetch<AggregatedScoreRead[]>(
        `/api/v1/domain/evaluation-criteria/${criterionId}/recalculate-scores`,
        {
          method: 'POST',
        }
      ),
  },

  // Health check
  health: {
    check: () => apiFetch<{ status: string; timestamp: string }>('/health'),
  },
};

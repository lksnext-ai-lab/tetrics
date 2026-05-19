
'use client';

import { 
  api, 
  type EvaluationCriterionRead, 
  type MetricRead, 
  type LLMToolConfigurationRead,
  type AggregatedScoreRead,
  type EvaluationProgramRead,
  type GoalRead,
  type MeasurementRead
} from './api';

// Frontend types (for UI components)
export type EvaluationProgram = {
  id: string;
  organizationContext: string;
  timePeriod: string;
  responsibleTeam: string;
  validityPeriod?: number;
  reevaluationTriggers?: string[];
};

export type Goal = {
  id: string;
  purpose: string;
  focus: string;
  viewpoint: string;
  context?: string;
  evaluationProgramId: string;
};

export type EvaluationCriterion = {
  id: string;
  dimension: string;
  description: string;
  weight: number;
  aggregationStrategy: 'weighted_average' | 'weighted_sum_normalized' | 'direct_metric_weights' | 'custom';
  goalId: string;
  metrics: Metric[];
};

export type Metric = {
  id: string;
  name: string;
  definition: string;
  unit: string;
  scaleType: 'nominal' | 'ordinal' | 'interval' | 'ratio';
  collectionMethod: string;
  normalizationMethod: 'none' | 'max' | 'min';
  weight: number;
  targetValue: number;
  direction: 'maximize' | 'minimize';
};

export type LLMToolConfiguration = {
  id: string;
  toolName: string;
  modelVersion: string;
  promptStrategy: string;
  parameters: Record<string, any>;
  timestamp: string;
  totalScore: number | null;
  totalScoreUpdatedAt: string | null;
  toolchain?: string;
  ide?: string;
  idePlugins?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  skillsUsed?: string[];
};

export type Measurement = {
  id: string;
  value: number;
  normalizedValue: number | null;
  evaluator: string;
  notes: string | null;
  llmToolConfigurationId: string;
  metricId: string;
  date: string;
};

export type AggregatedScore = {
  id: string;
  criterionID: string;
  toolConfigID: string;
  score: number | 'N/A';
  timestamp: string;
  componentMetrics: Record<string, number>;
};

// Adapter functions to convert backend data to frontend format
export function adaptEvaluationProgramToFrontend(program: EvaluationProgramRead): EvaluationProgram {
  return {
    id: program.id,
    organizationContext: program.organization_context,
    timePeriod: program.time_period,
    responsibleTeam: program.responsible_team,
    validityPeriod: program.validity_period,
    reevaluationTriggers: program.reevaluation_triggers,
  };
}

export function adaptGoalToFrontend(goal: GoalRead): Goal {
  return {
    id: goal.id,
    purpose: goal.purpose,
    focus: goal.focus,
    viewpoint: goal.viewpoint,
    context: goal.context,
    evaluationProgramId: goal.evaluation_program_id,
  };
}

export function adaptMetricToFrontend(metric: MetricRead): Metric {
  return {
    id: metric.id,
    name: metric.name,
    definition: metric.definition,
    unit: metric.unit,
    scaleType: metric.scale_type,
    collectionMethod: metric.collection_method,
    normalizationMethod: metric.normalization_method || 'none',
    weight: metric.weight,
    targetValue: metric.target_value || 0,
    direction: metric.direction === 'higher_is_better' ? 'maximize' : 'minimize',
  };
}

export function adaptCriterionToFrontend(
  criterion: EvaluationCriterionRead,
  metrics: MetricRead[]
): EvaluationCriterion {
  return {
    id: criterion.id,
    dimension: criterion.dimension,
    description: criterion.description,
    weight: criterion.weight,
    aggregationStrategy: criterion.aggregation_strategy as 'weighted_average' | 'weighted_sum_normalized' | 'direct_metric_weights' | 'custom',
    goalId: criterion.goal_id,
    metrics: metrics.map(adaptMetricToFrontend),
  };
}

export function adaptLLMToolConfigToFrontend(config: LLMToolConfigurationRead): LLMToolConfiguration {
  return {
    id: config.id,
    toolName: config.tool_name,
    modelVersion: config.model_version,
    promptStrategy: config.prompt_strategy,
    parameters: config.parameters,
    timestamp: config.timestamp,
    totalScore: config.total_score,
    totalScoreUpdatedAt: config.total_score_updated_at,
    toolchain: config.toolchain,
    ide: config.ide,
    idePlugins: config.ide_plugins,
    conversationHistory: config.conversation_history,
    skillsUsed: config.skills_used,
  };
}

export function adaptAggregatedScoreToFrontend(score: AggregatedScoreRead): AggregatedScore {
  return {
    id: score.id,
    criterionID: score.criterion_id,
    toolConfigID: score.tool_config_id,
    score: score.score,
    timestamp: score.timestamp,
    componentMetrics: score.component_metrics,
  };
}

export function adaptMeasurementToFrontend(measurement: MeasurementRead): Measurement {
  return {
    id: measurement.id,
    value: measurement.value,
    normalizedValue: measurement.normalized_value,
    evaluator: measurement.evaluator,
    notes: measurement.notes,
    llmToolConfigurationId: measurement.llm_tool_configuration_id,
    metricId: measurement.metric_id,
    date: measurement.date,
  };
}

// Data fetching functions
export async function fetchEvaluationPrograms(): Promise<EvaluationProgram[]> {
  try {
    const programs = await api.evaluationPrograms.getAll();
    return programs.map(adaptEvaluationProgramToFrontend);
  } catch (error) {
    console.error('Error fetching evaluation programs:', error);
    return [];
  }
}

export async function fetchGoals(): Promise<Goal[]> {
  try {
    const goals = await api.goals.getAll();
    return goals.map(adaptGoalToFrontend);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
}

export async function fetchEvaluationCriteria(): Promise<EvaluationCriterion[]> {
  try {
    const criteria = await api.evaluationCriteria.getAll();
    const criteriaWithMetrics = await Promise.all(
      criteria.map(async (criterion) => {
        try {
          const metrics = await api.metrics.getByCriterion(criterion.id);
          return adaptCriterionToFrontend(criterion, metrics);
        } catch (error) {
          console.error(`Error fetching metrics for criterion ${criterion.id}:`, error);
          // Return criterion with empty metrics array if fetching metrics fails
          return adaptCriterionToFrontend(criterion, []);
        }
      })
    );
    return criteriaWithMetrics;
  } catch (error) {
    console.error('Error fetching evaluation criteria:', error);
    return [];
  }
}

export async function fetchLLMToolConfigurations(): Promise<LLMToolConfiguration[]> {
  try {
    const configs = await api.llmToolConfigurations.getAll();
    return configs.map(adaptLLMToolConfigToFrontend);
  } catch (error) {
    console.error('Error fetching LLM tool configurations:', error);
    return [];
  }
}

export async function fetchAggregatedScores(): Promise<AggregatedScore[]> {
  try {
    const scores = await api.aggregatedScores.getAll();
    return scores.map(adaptAggregatedScoreToFrontend);
  } catch (error) {
    console.error('Error fetching aggregated scores:', error);
    return [];
  }
}

export async function fetchMeasurements(): Promise<Measurement[]> {
  try {
    // Request a larger page size to reduce chance of truncating newest measurements
    // (backend now orders by date DESC so page 0 includes latest values)
    const measurements = await api.measurements.getAll(0, 1000);
    return measurements.map(adaptMeasurementToFrontend);
  } catch (error) {
    console.error('Error fetching measurements:', error);
    return [];
  }
}

// Data creation/update functions
export async function createEvaluationProgram(data: {
  organizationContext: string;
  timePeriod: string;
  responsibleTeam: string;
  validityPeriod?: number;
  reevaluationTriggers?: string[];
}): Promise<EvaluationProgram> {
  const program = await api.evaluationPrograms.create({
    organization_context: data.organizationContext,
    time_period: data.timePeriod,
    responsible_team: data.responsibleTeam,
    validity_period: data.validityPeriod,
    reevaluation_triggers: data.reevaluationTriggers,
  });
  return adaptEvaluationProgramToFrontend(program);
}

export async function updateEvaluationProgram(id: string, data: {
  organizationContext: string;
  timePeriod: string;
  responsibleTeam: string;
  validityPeriod?: number;
  reevaluationTriggers?: string[];
}): Promise<EvaluationProgram> {
  const program = await api.evaluationPrograms.update(id, {
    organization_context: data.organizationContext,
    time_period: data.timePeriod,
    responsible_team: data.responsibleTeam,
    validity_period: data.validityPeriod,
    reevaluation_triggers: data.reevaluationTriggers,
  });
  return adaptEvaluationProgramToFrontend(program);
}

export async function createGoal(data: {
  purpose: string;
  focus: string;
  viewpoint: string;
  context?: string;
  evaluationProgramId: string;
}): Promise<Goal> {
  const goal = await api.goals.create({
    purpose: data.purpose,
    focus: data.focus,
    viewpoint: data.viewpoint,
    context: data.context,
    evaluation_program_id: data.evaluationProgramId,
  });
  return adaptGoalToFrontend(goal);
}

export async function updateGoal(id: string, data: {
  purpose: string;
  focus: string;
  viewpoint: string;
  context?: string;
  evaluationProgramId: string;
}): Promise<Goal> {
  const goal = await api.goals.update(id, {
    purpose: data.purpose,
    focus: data.focus,
    viewpoint: data.viewpoint,
    context: data.context,
    evaluation_program_id: data.evaluationProgramId,
  });
  return adaptGoalToFrontend(goal);
}


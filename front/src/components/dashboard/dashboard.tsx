
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './header';
import { EvalTableEnhanced } from './eval-table-enhanced';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type {
  EvaluationProgram,
  Goal,
  EvaluationCriterion,
  LLMToolConfiguration,
  AggregatedScore,
  Measurement
} from '@/lib/data';
import {
  fetchEvaluationPrograms,
  fetchGoals,
  fetchEvaluationCriteria,
  fetchLLMToolConfigurations,
  fetchAggregatedScores,
  fetchMeasurements,
  adaptMeasurementToFrontend
} from '@/lib/data';
import { api } from '@/lib/api';
import { AddLlmToolDialog } from './add-model-dialog';
import { AddMeasurementDialog } from './add-measurement-dialog';
import { AddCriterionDialog } from './add-criterion-dialog';
import { AddMetricDialog } from './add-metric-dialog';
import { EditContextSheet } from './edit-context-sheet';
import { DateFilter } from './date-filter';
import { DateRange } from 'react-day-picker';

interface DashboardProps {
  /** Optional goalId to scope the dashboard to a single goal (detail view). */
  goalId?: string;
}

export function Dashboard({ goalId }: Readonly<DashboardProps>) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = Boolean(user?.roles?.includes('admin'));
  const [evaluationProgram, setEvaluationProgram] = useState<EvaluationProgram | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [llmTools, setLlmTools] = useState<LLMToolConfiguration[]>([]);
  const [scores, setScores] = useState<AggregatedScore[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  // Sorting for LLM tool columns (by timestamp)
  // Default: 'asc' so the table initially shows tools left-to-right by timestamp
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const [isAddLlmToolDialogOpen, setIsAddLlmToolDialogOpen] = useState(false);
  const [isEditContextSheetOpen, setIsEditContextSheetOpen] = useState(false);
  const [isAddMeasurementDialogOpen, setIsAddMeasurementDialogOpen] = useState(false);
  const [isAddCriterionDialogOpen, setIsAddCriterionDialogOpen] = useState(false);
  const [isAddMetricDialogOpen, setIsAddMetricDialogOpen] = useState(false);
  const [editingLlmTool, setEditingLlmTool] = useState<LLMToolConfiguration | undefined>(undefined);
  const [selectedMeasurementContext, setSelectedMeasurementContext] = useState<{
    llmToolConfigId: string;
    metricId: string;
    metricName: string;
    toolName: string;
    existingMeasurement?: Measurement;
  } | null>(null);
  const [selectedCriterionForMetric, setSelectedCriterionForMetric] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const determineSelectedGoal = (
    goalsData: Goal[], 
    programsData: EvaluationProgram[]
  ): Goal | undefined => {
    if (goalId) {
      const foundGoal = goalsData.find(g => g.id === goalId);
      if (foundGoal) return foundGoal;
    }
    
    if (programsData.length > 0) {
      return goalsData.find(g => g.evaluationProgramId === programsData[0].id);
    }
    
    return undefined;
  };

  const filterCriteriaAndScores = (
    criteriaData: EvaluationCriterion[],
    scoresData: AggregatedScore[],
    selectedGoal: Goal | undefined
  ) => {
    const filteredCriteria = selectedGoal
      ? criteriaData.filter(c => c.goalId === selectedGoal.id)
      : criteriaData;

    const criterionIdSet = new Set(filteredCriteria.map(c => c.id));
    const filteredScores = scoresData.filter(s => criterionIdSet.has(s.criterionID));

    return { filteredCriteria, filteredScores, criterionIdSet };
  };

  const detectMissingScores = (
    filteredCriteria: EvaluationCriterion[],
    llmToolsData: LLMToolConfiguration[],
    filteredScores: AggregatedScore[]
  ): Set<string> => {
    const existingScorePairs = new Set(
      filteredScores.map(s => `${s.criterionID}::${s.toolConfigID}`)
    );
    const criteriaNeedingRecalc = new Set<string>();

    for (const criterion of filteredCriteria) {
      for (const tool of llmToolsData) {
        const key = `${criterion.id}::${tool.id}`;
        if (!existingScorePairs.has(key)) {
          criteriaNeedingRecalc.add(criterion.id);
        }
      }
    }

    return criteriaNeedingRecalc;
  };

  const recalculateMissingScores = async (
    criteriaNeedingRecalc: Set<string>,
    criterionIdSet: Set<string>
  ): Promise<AggregatedScore[]> => {
    if (criteriaNeedingRecalc.size === 0) {
      return [];
    }

    try {
      await Promise.all(
        Array.from(criteriaNeedingRecalc).map(id => 
          api.aggregatedScores.recalculateForCriterion(id)
        )
      );
      
      const refreshedScores = await fetchAggregatedScores();
      return refreshedScores.filter(s => criterionIdSet.has(s.criterionID));
    } catch (err) {
      console.error('Error recalculating missing aggregated scores:', err);
      return [];
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [programsData, goalsData, criteriaData, llmToolsData, scoresData, measurementsData] = await Promise.all([
        fetchEvaluationPrograms(),
        fetchGoals(),
        fetchEvaluationCriteria(),
        fetchLLMToolConfigurations(),
        fetchAggregatedScores(),
        fetchMeasurements(),
      ]);
      
      // Determine selected evaluation program (first for now)
      if (programsData.length > 0) {
        setEvaluationProgram(programsData[0]);
      }

      // Resolve selected goal
      const selectedGoal = determineSelectedGoal(goalsData, programsData);
      if (selectedGoal) {
        setGoal(selectedGoal);
      }

      // Filter criteria and scores
      const { filteredCriteria, filteredScores, criterionIdSet } = filterCriteriaAndScores(
        criteriaData,
        scoresData,
        selectedGoal
      );

      // Detect missing aggregated score entries
      const criteriaNeedingRecalc = detectMissingScores(
        filteredCriteria,
        llmToolsData,
        filteredScores
      );

      // Recalculate missing scores
      const recalculatedScores = await recalculateMissingScores(
        criteriaNeedingRecalc,
        criterionIdSet
      );

      // Update state with recalculated scores if any
      const finalScores = recalculatedScores.length > 0 ? recalculatedScores : filteredScores;

      setCriteria(filteredCriteria);
      setLlmTools(llmToolsData);
      setScores(finalScores);
      setMeasurements(measurementsData);
      
      if (criteriaData.length === 0 && llmToolsData.length === 0) {
        toast({
          title: 'No Data',
          description: 'No evaluation data found. The database may be empty.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to load data from the backend. Please check your connection.';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleAddLlmTool = async (data: {
    toolName: string;
    modelVersion: string;
    promptStrategy: string;
    parameters: Record<string, any>;
    timestamp: string;
    toolchain?: string;
    ide?: string;
    idePlugins?: string[];
    conversationHistory?: Array<{ role: string; content: string }>;
    skillsUsed?: string[];
  }) => {
    try {
      // Create the tool configuration on the backend
      const newConfig = await api.llmToolConfigurations.create({
        tool_name: data.toolName,
        model_version: data.modelVersion,
        prompt_strategy: data.promptStrategy,
        parameters: data.parameters,
        timestamp: data.timestamp,
        toolchain: data.toolchain,
        ide: data.ide,
        ide_plugins: data.idePlugins,
        conversation_history: data.conversationHistory,
        skills_used: data.skillsUsed,
      });

      // Add to local state
      const newToolConfig: LLMToolConfiguration = {
        id: newConfig.id,
        toolName: newConfig.tool_name,
        modelVersion: newConfig.model_version,
        promptStrategy: newConfig.prompt_strategy,
        parameters: newConfig.parameters,
        timestamp: newConfig.timestamp,
        totalScore: null,
        totalScoreUpdatedAt: null,
        toolchain: newConfig.toolchain,
        ide: newConfig.ide,
        idePlugins: newConfig.ide_plugins,
        conversationHistory: newConfig.conversation_history,
        skillsUsed: newConfig.skills_used,
      };

      setLlmTools(prev => [...prev, newToolConfig]);

      // Create placeholder aggregated scores for each criterion
      const newScores: AggregatedScore[] = criteria.map(c => ({
        id: `${c.id}-${newToolConfig.id}`,
        criterionID: c.id,
        toolConfigID: newToolConfig.id,
        score: 'N/A',
        timestamp: new Date().toISOString(),
        componentMetrics: {},
      }));
      setScores(prev => [...prev, ...newScores]);

      toast({
        title: 'LLM Tool Added',
        description: `Successfully added "${data.toolName} - ${data.modelVersion}".`,
      });
      setIsAddLlmToolDialogOpen(false);
    } catch (error) {
      console.error('Error adding LLM tool:', error);
      let errorMessage = 'Failed to add LLM tool configuration. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleContextSave = async (
    updatedProgram: EvaluationProgram, 
    updatedGoal: Goal, 
    updatedCriteria: EvaluationCriterion[]
  ) => {
    try {
      // Update evaluation program
      if (evaluationProgram) {
        await api.evaluationPrograms.update(evaluationProgram.id, {
          organization_context: updatedProgram.organizationContext,
          time_period: updatedProgram.timePeriod,
          responsible_team: updatedProgram.responsibleTeam,
        });
        setEvaluationProgram(updatedProgram);
      }

      // Update goal
      if (goal) {
        await api.goals.update(goal.id, {
          purpose: updatedGoal.purpose,
          focus: updatedGoal.focus,
          viewpoint: updatedGoal.viewpoint,
          context: updatedGoal.context,
          evaluation_program_id: updatedGoal.evaluationProgramId,
        });
        setGoal(updatedGoal);
      }

      // Track which criteria need recalculation
      const criteriaToRecalculate = new Set<string>();

      const updateCriterionAndMetrics = async (criterion: EvaluationCriterion): Promise<boolean> => {
        const originalCriterion = criteria.find(c => c.id === criterion.id);
        const criterionChanged = !!originalCriterion && (
          originalCriterion.weight !== criterion.weight ||
          originalCriterion.aggregationStrategy !== criterion.aggregationStrategy
        );

        await api.evaluationCriteria.update(criterion.id, {
          dimension: criterion.dimension,
          description: criterion.description,
          weight: criterion.weight,
          aggregation_strategy: criterion.aggregationStrategy,
        });

        let metricWeightChangedAffects = false;
        for (const metric of criterion.metrics) {
          const originalMetric = originalCriterion?.metrics.find(m => m.id === metric.id);
          if (originalMetric && originalMetric.weight !== metric.weight &&
              (criterion.aggregationStrategy === 'weighted_sum_normalized' ||
               criterion.aggregationStrategy === 'direct_metric_weights' ||
               criterion.aggregationStrategy === 'custom')) {
            metricWeightChangedAffects = true;
          }
          await api.metrics.update(metric.id, {
            name: metric.name,
            definition: metric.definition,
            unit: metric.unit,
            scale_type: metric.scaleType,
            collection_method: metric.collectionMethod,
            normalization_method: metric.normalizationMethod || 'none',
            weight: metric.weight,
            target_value: metric.targetValue,
            direction: metric.direction === 'maximize' ? 'higher_is_better' : 'lower_is_better',
          });
        }

        return criterionChanged || metricWeightChangedAffects;
      };

      for (const criterion of updatedCriteria) {
        const needsRecalculation = await updateCriterionAndMetrics(criterion);
        if (needsRecalculation) criteriaToRecalculate.add(criterion.id);
      }

      // Recalculate scores for affected criteria
      console.log('Criteria to recalculate:', criteriaToRecalculate);
      for (const criterionId of criteriaToRecalculate) {
        try {
          console.log(`Recalculating criterion ${criterionId}...`);
          const recalculatedScores = await api.aggregatedScores.recalculateForCriterion(criterionId);
          console.log(`Recalculated ${recalculatedScores.length} scores for criterion ${criterionId}`);
        } catch (error) {
          console.error(`Error recalculating scores for criterion ${criterionId}:`, error);
        }
      }

      // Update local state
      setCriteria(updatedCriteria);

      // Reload scores to reflect recalculated values
      if (criteriaToRecalculate.size > 0) {
        const updatedScores = await fetchAggregatedScores();
        setScores(updatedScores);
      }

      toast({
        title: 'Context Saved',
        description: `The evaluation context has been updated successfully.${criteriaToRecalculate.size > 0 ? ' Scores recalculated.' : ''}`,
      });
      setIsEditContextSheetOpen(false);
    } catch (error) {
      console.error('Error saving context:', error);
      let errorMessage = 'Failed to save the evaluation context. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleScoreUpdate = (scoreId: string, newScore: number) => {
    setScores(prevScores => {
      return prevScores.map(score => {
        if (score.id === scoreId) {
          return { ...score, score: newScore, timestamp: new Date().toISOString() };
        }
        return score;
      });
    });
    // Here you would also make an API call to update the score on the backend
  };

  const handleAddMeasurement = async (
    value: number,
    notes: string,
    llmToolConfigId: string,
    metricId: string
  ) => {
    try {
      // Check if we're updating an existing measurement
      const existingMeasurement = selectedMeasurementContext?.existingMeasurement;

      console.log('[DEBUG] handleAddMeasurement called');
      console.log('[DEBUG] existingMeasurement:', existingMeasurement);
      console.log('[DEBUG] metricId:', metricId, 'toolId:', llmToolConfigId);
      console.log('[DEBUG] Current measurements in state:', measurements.length);

      // Re-derive current measurement from fresh state to avoid stale existingMeasurement
      const currentMeasurement = measurements.find(m => m.metricId === metricId && m.llmToolConfigurationId === llmToolConfigId);
      const isEdit = Boolean(existingMeasurement && currentMeasurement && existingMeasurement.id === currentMeasurement.id);
      console.log('[DEBUG] currentMeasurement (live lookup):', currentMeasurement);
      console.log('[DEBUG] isEdit decision:', isEdit);

      const evaluator = user?.username || 'unknown';

      let optimisticMeasurement: Measurement | null = null;

      if (existingMeasurement && isEdit) {
        console.log('[DEBUG] Updating existing measurement (confirmed):', existingMeasurement.id);
        const updated = await api.measurements.update(existingMeasurement.id, {
          value,
          evaluator,
          notes: notes || null,
          date: new Date().toISOString(),
        });
        optimisticMeasurement = adaptMeasurementToFrontend(updated);
        toast({
          title: 'Measurement Updated',
          description: 'The measurement has been updated successfully.',
        });
      } else {
        console.log('[DEBUG] Creating new measurement');
        const created = await api.measurements.create({
          value,
          evaluator,
          notes: notes || null,
          llm_tool_configuration_id: llmToolConfigId,
          metric_id: metricId,
          date: new Date().toISOString(),
        });
        optimisticMeasurement = adaptMeasurementToFrontend(created);
        toast({
          title: 'Measurement Added',
          description: 'The measurement has been added successfully.',
        });
      }

      // Optimistically update local state so UI reflects the change immediately
      if (optimisticMeasurement) {
        setMeasurements(prev => {
          // Replace if same id exists
          const existingIndex = prev.findIndex(m => m.id === optimisticMeasurement.id);
          if (existingIndex !== -1) {
            const next = [...prev];
            next[existingIndex] = optimisticMeasurement;
            return next;
          }
          // Remove any prior measurement for same metric/tool combination
          const withoutOld = prev.filter(m => !(m.metricId === optimisticMeasurement.metricId && m.llmToolConfigurationId === optimisticMeasurement.llmToolConfigurationId));
          return [...withoutOld, optimisticMeasurement];
        });
      }

      // After saving a measurement, trigger backend recalculation for affected criterion/tool
      try {
        // Find the affected criterion for the metric
        const affectedCriterion = criteria.find(c => c.metrics.some(m => m.id === metricId));
        if (affectedCriterion) {
          await api.aggregatedScores.recalculateForCriterion(affectedCriterion.id);
        }
        
        // Small delay to ensure backend transaction is committed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now fetch updated measurements and scores
        const [measurementsData, scoresData] = await Promise.all([
          fetchMeasurements(),
          fetchAggregatedScores(),
        ]);
        
        console.log('[DEBUG] Fetched measurements:', measurementsData.length);
        console.log('[DEBUG] Looking for measurement with metricId:', metricId, 'toolId:', llmToolConfigId);
        const newMeasurement = measurementsData.find(m => m.metricId === metricId && m.llmToolConfigurationId === llmToolConfigId);
        console.log('[DEBUG] Found measurement:', newMeasurement);
        
        // Don't filter out measurements - keep all of them so measurements from other LLMs don't disappear
        // The table component will only display measurements for metrics it shows
        setMeasurements(measurementsData);
        // Filter scores to only include those for the current criteria shown
        const criterionIdSet = new Set(criteria.map(c => c.id));
        const filteredScores = scoresData.filter(s => criterionIdSet.has(s.criterionID));
        setScores(filteredScores);

        // Clear measurement context after successful operation to prevent stale edit mode
        setSelectedMeasurementContext(null);
      } catch (err) {
        console.error('Error refreshing measurements/scores:', err);
      }
    } catch (error) {
      console.error('Error saving measurement:', error);
      let errorMessage = 'Failed to save measurement. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleOpenMeasurementDialog = (
    llmToolConfigId: string,
    metricId: string,
    metricName: string,
    toolName: string,
    existingMeasurement?: Measurement
  ) => {
    // Debug: list all measurements matching this metric/tool
    const related = measurements.filter(m => m.metricId === metricId && m.llmToolConfigurationId === llmToolConfigId);
    console.log('[DEBUG] Opening measurement dialog for metric', metricId, 'tool', llmToolConfigId);
    console.log('[DEBUG] Existing measurement passed:', existingMeasurement);
    console.log('[DEBUG] Related measurements count:', related.length, related);
    setSelectedMeasurementContext({ llmToolConfigId, metricId, metricName, toolName, existingMeasurement });
    setIsAddMeasurementDialogOpen(true);
  };

  const handleEditLlmTool = (tool: LLMToolConfiguration) => {
    setEditingLlmTool(tool);
    setIsAddLlmToolDialogOpen(true);
  };

  const handleUpdateLlmTool = async (
    toolId: string,
    data: {
      toolName: string;
      modelVersion: string;
      promptStrategy: string;
      parameters: Record<string, any>;
      timestamp: string;
      toolchain?: string;
      ide?: string;
      idePlugins?: string[];
      conversationHistory?: Array<{ role: string; content: string }>;
      skillsUsed?: string[];
    }
  ) => {
    try {
      // Update the tool configuration on the backend
      await api.llmToolConfigurations.update(toolId, {
        tool_name: data.toolName,
        model_version: data.modelVersion,
        prompt_strategy: data.promptStrategy,
        parameters: data.parameters,
        timestamp: data.timestamp,
        toolchain: data.toolchain,
        ide: data.ide,
        ide_plugins: data.idePlugins,
        conversation_history: data.conversationHistory,
        skills_used: data.skillsUsed,
      });

      // Update local state
      setLlmTools(prev => prev.map(tool => 
        tool.id === toolId 
          ? {
              ...tool,
              toolName: data.toolName,
              modelVersion: data.modelVersion,
              promptStrategy: data.promptStrategy,
              parameters: data.parameters,
              timestamp: data.timestamp,
              toolchain: data.toolchain,
              ide: data.ide,
              idePlugins: data.idePlugins,
              conversationHistory: data.conversationHistory,
              skillsUsed: data.skillsUsed,
            }
          : tool
      ));

      toast({
        title: 'LLM Tool Updated',
        description: `Successfully updated "${data.toolName} - ${data.modelVersion}".`,
      });
      
      setEditingLlmTool(undefined);
      setIsAddLlmToolDialogOpen(false);
    } catch (error) {
      console.error('Error updating LLM tool:', error);
      let errorMessage = 'Failed to update LLM tool configuration. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    setIsAddLlmToolDialogOpen(isOpen);
    if (!isOpen) {
      setEditingLlmTool(undefined);
    }
  };

  const handleOpenCriterionDialog = () => {
    if (!goal) {
      toast({
        title: 'No Goal Selected',
        description: 'Please select a goal first.',
        variant: 'destructive',
      });
      return;
    }
    setIsAddCriterionDialogOpen(true);
  };

  const handleCriterionSuccess = () => {
    loadData(); // Reload all data
  };

  const handleOpenMetricDialog = (criterionId: string) => {
    setSelectedCriterionForMetric(criterionId);
    setIsAddMetricDialogOpen(true);
  };

  const handleMetricSuccess = () => {
    loadData(); // Reload all data
  };

  // Filter llmTools based on date range and sort by timestamp according to sortDirection
  const filteredLlmTools = useMemo(() => {
    let filtered = llmTools;

    if (dateRange?.from || dateRange?.to) {
      filtered = llmTools.filter((tool) => {
        const toolDate = new Date(tool.timestamp);
        const from = dateRange.from;
        const to = dateRange.to;

        if (from && to) {
          return toolDate >= from && toolDate <= to;
        } else if (from) {
          return toolDate >= from;
        } else if (to) {
          return toolDate <= to;
        }
        return true;
      });
    }

    // Always sort by timestamp for initial presentation; user can toggle direction
    filtered = [...filtered].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortDirection === 'asc' ? ta - tb : tb - ta;
    });

    return filtered;
  }, [llmTools, dateRange, sortDirection]);

  const handleBackToGoals = () => {
    // Navigate to the goals listing (root path)
    router.push('/');
  };

  const handleLogoHome = () => {
    router.push('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header
        onAddMeasure={() => setIsAddLlmToolDialogOpen(true)}
        onEditContext={() => setIsEditContextSheetOpen(true)}
        onBack={goalId ? handleBackToGoals : undefined}
        onLogoClick={handleLogoHome}
        canManage={isAdmin}
        username={user?.username}
        onLogout={logout}
      />
      <main className="flex-1 overflow-y-auto px-6 sm:px-8 md:px-12 lg:px-16 py-6">
        <div className="w-full mx-auto space-y-6 max-w-none">
          {!isLoading && (
            <div className="flex justify-end items-center space-x-2">
              <DateFilter 
                dateRange={dateRange} 
                onDateRangeChange={setDateRange}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                title="Toggle LLM tool column sort"
              >
                {sortDirection === 'asc' ? 'Sort: Old → New' : 'Sort: New → Old'}
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading data from backend...</p>
            </div>
          ) : (
            <EvalTableEnhanced 
              criteria={criteria} 
              llmTools={filteredLlmTools}
              scores={scores}
              measurements={measurements}
              onScoreUpdate={handleScoreUpdate}
              onAddMeasurement={handleOpenMeasurementDialog}
              onEditLlmTool={handleEditLlmTool}
              canEditTools={isAdmin}
              scopedToSingleGoal={Boolean(goalId)}
            />
          )}
        </div>
      </main>
      <Toaster />
      <AddLlmToolDialog
        isOpen={isAddLlmToolDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onAddLlmTool={handleAddLlmTool}
        criteria={criteria}
        editingTool={editingLlmTool}
        onUpdateLlmTool={handleUpdateLlmTool}
      />
      {selectedMeasurementContext && (
        <AddMeasurementDialog
          isOpen={isAddMeasurementDialogOpen}
          onOpenChange={setIsAddMeasurementDialogOpen}
          onAddMeasurement={handleAddMeasurement}
          llmToolConfigId={selectedMeasurementContext.llmToolConfigId}
          metricId={selectedMeasurementContext.metricId}
          metricName={selectedMeasurementContext.metricName}
          toolName={selectedMeasurementContext.toolName}
          existingMeasurement={selectedMeasurementContext.existingMeasurement}
          evaluator={user?.username || 'unknown'}
        />
      )}
      <EditContextSheet
        isOpen={isEditContextSheetOpen}
        onOpenChange={setIsEditContextSheetOpen}
        evaluationProgram={evaluationProgram}
        goal={goal}
        criteria={criteria}
        onSave={handleContextSave}
        onAddCriterion={handleOpenCriterionDialog}
        onAddMetric={handleOpenMetricDialog}
        canEdit={isAdmin}
      />
      {goal && (
        <AddCriterionDialog
          open={isAddCriterionDialogOpen}
          onOpenChange={setIsAddCriterionDialogOpen}
          goalId={goal.id}
          onSuccess={handleCriterionSuccess}
        />
      )}
      {selectedCriterionForMetric && (
        <AddMetricDialog
          open={isAddMetricDialogOpen}
          onOpenChange={setIsAddMetricDialogOpen}
          criterionId={selectedCriterionForMetric}
          onSuccess={handleMetricSuccess}
        />
      )}
    </div>
  );
}

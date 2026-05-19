'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../dashboard/header';
import { GoalsOverviewTable } from './goals-overview-table';
import { GoalDialog } from './goal-dialog';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { AdminOnlyButton } from '@/components/ui/admin-only-button';
import { ProgramDialog } from './program-dialog';
import { Edit, PlusCircle } from 'lucide-react';
import type { 
  EvaluationProgram, 
  Goal, 
  LLMToolConfiguration,
  EvaluationCriterion,
  AggregatedScore,
} from '@/lib/data';
import { 
  fetchEvaluationPrograms, 
  fetchGoals, 
  fetchLLMToolConfigurations,
  fetchEvaluationCriteria,
  fetchAggregatedScores,
} from '@/lib/data';

interface GoalsOverviewProps {
  onGoalSelect?: (goalId: string) => void;
}

export function GoalsOverview({ onGoalSelect }: Readonly<GoalsOverviewProps>) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = Boolean(user?.roles?.includes('admin'));
  const [evaluationProgram, setEvaluationProgram] = useState<EvaluationProgram | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [llmTools, setLlmTools] = useState<LLMToolConfiguration[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [scores, setScores] = useState<AggregatedScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isProgramDialogOpen, setIsProgramDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [programsData, goalsData, llmToolsData, criteriaData, scoresData] = await Promise.all([
        fetchEvaluationPrograms(),
        fetchGoals(),
        fetchLLMToolConfigurations(),
        fetchEvaluationCriteria(),
        fetchAggregatedScores(),
      ]);
      
      // Get the first evaluation program
      if (programsData.length > 0) {
        setEvaluationProgram(programsData[0]);
      }
      
      setGoals(goalsData);
      setLlmTools(llmToolsData);
      setCriteria(criteriaData);
      setScores(scoresData);
      
      if (goalsData.length === 0 || llmToolsData.length === 0) {
        toast({
          title: 'Limited Data',
          description: 'Some data is missing. Please ensure goals and LLM tools are configured.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data from the backend. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoalClick = (goalId: string) => {
    if (onGoalSelect) {
      onGoalSelect(goalId);
    } else {
      // Navigate to the goal detail page
      router.push(`/goals/${goalId}`);
    }
  };

  const handleCreateGoal = () => {
    setSelectedGoal(null);
    setIsGoalDialogOpen(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsGoalDialogOpen(true);
  };

  const handleGoalDialogSuccess = () => {
    loadData(); // Reload all data after successful create/update
  };

  const handleEditProgram = () => {
    setIsProgramDialogOpen(true);
  };

  const newGoalButton = (
    <AdminOnlyButton
      allowed={isAdmin}
      tooltip="Admin role required to create goals."
      onClick={handleCreateGoal}
    >
      <PlusCircle className="mr-2 h-4 w-4" />
      New Goal
    </AdminOnlyButton>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header
        showActionButtons={false}
        username={user?.username}
        onLogout={logout}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading data from backend...</p>
            </div>
          ) : (
            <>
              {evaluationProgram && (
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-3xl font-bold tracking-tight">
                          Evaluation Program Overview
                        </h2>
                        <AdminOnlyButton
                          allowed={isAdmin}
                          tooltip="Admin role required to edit evaluation program."
                          variant="ghost"
                          size="icon"
                          onClick={handleEditProgram}
                        >
                          <Edit className="h-4 w-4" />
                        </AdminOnlyButton>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <span className="font-medium">Organization:</span>{' '}
                          {evaluationProgram.organizationContext}
                        </p>
                        <p>
                          <span className="font-medium">Time Period:</span>{' '}
                          {evaluationProgram.timePeriod}
                        </p>
                        <p>
                          <span className="font-medium">Responsible Team:</span>{' '}
                          {evaluationProgram.responsibleTeam}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {newGoalButton}
                    </div>
                  </div>
                </div>
              )}
              {!evaluationProgram && (
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight mb-2">
                        Goals Overview
                      </h2>
                      <p className="text-muted-foreground">
                        No evaluation program found. Create your first goal to get started.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {newGoalButton}
                    </div>
                  </div>
                </div>
              )}
              <GoalsOverviewTable 
                goals={goals}
                llmTools={llmTools}
                criteria={criteria}
                scores={scores}
                onGoalClick={handleGoalClick}
                onEditGoal={handleEditGoal}
                canEdit={isAdmin}
              />
            </>
          )}
        </div>
      </main>
      <GoalDialog
        open={isGoalDialogOpen}
        onOpenChange={setIsGoalDialogOpen}
        goal={selectedGoal}
        evaluationProgram={evaluationProgram}
        onSuccess={handleGoalDialogSuccess}
      />
      <ProgramDialog
        open={isProgramDialogOpen}
        onOpenChange={setIsProgramDialogOpen}
        evaluationProgram={evaluationProgram}
        onSuccess={handleGoalDialogSuccess}
      />
      <Toaster />
    </div>
  );
}

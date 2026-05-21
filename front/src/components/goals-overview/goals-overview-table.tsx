'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminOnlyButton } from '@/components/ui/admin-only-button';
import type { Goal, LLMToolConfiguration, EvaluationCriterion, AggregatedScore } from '@/lib/data';

interface GoalsOverviewTableProps {
  goals: Goal[];
  llmTools: LLMToolConfiguration[];
  criteria: EvaluationCriterion[];
  scores: AggregatedScore[];
  onGoalClick?: (goalId: string) => void;
  onEditGoal?: (goal: Goal) => void;
  canEdit?: boolean;
}

type SortConfig = {
  key: string | null;
  direction: 'asc' | 'desc';
};

type GoalScore = {
  goalId: string;
  toolId: string;
  score: number | null;
};

export function GoalsOverviewTable({ 
  goals, 
  llmTools, 
  criteria, 
  scores, 
  onGoalClick,
  onEditGoal,
  canEdit = true
}: Readonly<GoalsOverviewTableProps>) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  // Calculate overall scores for each goal and LLM tool combination
  const goalScores = useMemo(() => {
    const scoresMap = new Map<string, GoalScore>();

    for (const goal of goals) {
      // Get all criteria for this goal
      const goalCriteria = criteria.filter(c => c.goalId === goal.id);
      
      for (const tool of llmTools) {
        const key = `${goal.id}-${tool.id}`;
        
        // Sum the aggregated scores for this goal's criteria
        // Note: Aggregated scores are already weighted by criterion weight
        let totalScore = 0;
        let hasAnyScore = false;

        for (const criterion of goalCriteria) {
          const criterionScore = scores.find(s => 
            s.criterionID === criterion.id && s.toolConfigID === tool.id
          );

          if (criterionScore && criterionScore.score !== 'N/A' && typeof criterionScore.score === 'number') {
            totalScore += criterionScore.score;
            hasAnyScore = true;
          }
        }

        const overallScore = hasAnyScore ? totalScore : null;

        scoresMap.set(key, {
          goalId: goal.id,
          toolId: tool.id,
          score: overallScore,
        });
      }
    }

    return scoresMap;
  }, [goals, llmTools, criteria, scores]);

  // Calculate rankings for each goal (which LLM is best for each goal)
  const toolRankings = useMemo(() => {
    const rankings = new Map<string, Map<string, number>>();

    for (const goal of goals) {
      const goalRankings = new Map<string, number>();
      
      // Get scores for all tools for this goal
      const toolScoresForGoal = llmTools
        .map(tool => ({
          toolId: tool.id,
          score: goalScores.get(`${goal.id}-${tool.id}`)?.score ?? -Infinity,
        }))
        .filter(item => item.score !== null && item.score !== -Infinity)
        .sort((a, b) => b.score - a.score);

      // Assign ranks
      let index = 0;
      for (const item of toolScoresForGoal) {
        goalRankings.set(item.toolId, index + 1);
        index++;
      }

      rankings.set(goal.id, goalRankings);
    }

    return rankings;
  }, [goals, llmTools, goalScores]);

  // Get overall score for a specific goal and LLM tool
  const getGoalScore = (goalId: string, toolId: string): string => {
    const goalScore = goalScores.get(`${goalId}-${toolId}`);
    if (goalScore?.score !== null && goalScore?.score !== undefined) {
      return goalScore.score.toFixed(2);
    }
    return 'N/A';
  };

  // Get rank for a specific tool in a specific goal
  const getToolRank = (goalId: string, toolId: string): number | null => {
    return toolRankings.get(goalId)?.get(toolId) ?? null;
  };

  // Get score badge variant based on rank
  const getScoreBadgeVariant = (rank: number | null): 'default' | 'secondary' | 'outline' => {
    if (rank === 1) return 'default'; // Best - primary color
    if (rank === 2) return 'secondary'; // Second best
    return 'outline'; // Rest
  };

  // Sort LLM tools columns by their overall performance across all goals
  const sortedLlmTools = useMemo(() => {
    const toolsWithAvgScores = llmTools.map(tool => {
      let totalScore = 0;
      let count = 0;

      for (const goal of goals) {
        const scoreStr = getGoalScore(goal.id, tool.id);
        if (scoreStr !== 'N/A') {
          totalScore += Number.parseFloat(scoreStr);
          count++;
        }
      }

      const avgScore = count > 0 ? totalScore / count : -Infinity;

      return {
        tool,
        avgScore,
      };
    });

    // Sort by average score descending (best first)
    toolsWithAvgScores.sort((a, b) => b.avgScore - a.avgScore);

    return toolsWithAvgScores.map((item, index) => ({
      ...item.tool,
      overallRank: item.avgScore === -Infinity ? null : index + 1,
    }));
  }, [llmTools, goals, goalScores]);

  // Sort goals based on selected column
  const sortedGoals = useMemo(() => {
    if (!sortConfig.key) return goals;

    const sorted = [...goals].sort((a, b) => {
      if (sortConfig.key === 'goal') {
        // Sort by goal purpose
        return a.purpose.localeCompare(b.purpose);
      } else if (sortConfig.key) {
        // Sort by LLM tool score for this specific goal
        const scoreA = Number.parseFloat(getGoalScore(a.id, sortConfig.key));
        const scoreB = Number.parseFloat(getGoalScore(b.id, sortConfig.key));
        
        if (Number.isNaN(scoreA) && Number.isNaN(scoreB)) return 0;
        if (Number.isNaN(scoreA)) return 1;
        if (Number.isNaN(scoreB)) return -1;
        
        return scoreA - scoreB;
      }
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [goals, sortConfig, goalScores]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleGoalClick = (goalId: string) => {
    if (onGoalClick) {
      onGoalClick(goalId);
    }
  };

  const handleEditClick = (e: React.MouseEvent, goal: Goal) => {
    e.stopPropagation(); // Prevent row click
    if (onEditGoal) {
      onEditGoal(goal);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Goals Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare overall performance of LLM tools across all evaluation goals
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px] sticky left-0 bg-background z-10">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('goal')}
                    className="h-8 px-2 font-semibold"
                  >
                    Goal
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                {sortedLlmTools.map((tool) => (
                  <TableHead key={tool.id} className="text-center min-w-[150px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(tool.id)}
                      className="h-auto px-2 font-semibold flex flex-col items-center w-full"
                    >
                      <div className="flex items-center gap-2">
                        {tool.overallRank && (
                          <Badge variant={getScoreBadgeVariant(tool.overallRank)}>
                            #{tool.overallRank}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-normal mt-1">
                        {tool.toolName}
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {tool.modelVersion}
                      </div>
                      <ArrowUpDown className="h-3 w-3 mt-1" />
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGoals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={sortedLlmTools.length + 1}
                    className="text-center text-muted-foreground h-24"
                  >
                    No goals found. Create a goal to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedGoals.map((goal) => (
                  <TableRow
                    key={goal.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleGoalClick(goal.id)}
                  >
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{goal.purpose}</span>
                          {onEditGoal && (
                            <AdminOnlyButton
                              allowed={canEdit}
                              tooltip="Admin role required to edit goals."
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleEditClick(e, goal)}
                            >
                              <Edit className="h-4 w-4" />
                            </AdminOnlyButton>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          <span className="font-medium">Focus:</span> {goal.focus}
                        </div>
                        {goal.context && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            <span className="font-medium">Context:</span> {goal.context}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {sortedLlmTools.map((tool) => {
                      const score = getGoalScore(goal.id, tool.id);
                      const rank = getToolRank(goal.id, tool.id);
                      const isNA = score === 'N/A';
                      
                      return (
                        <TableCell key={tool.id} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {rank && (
                              <Badge variant="outline" className="text-xs">
                                #{rank}
                              </Badge>
                            )}
                            {isNA ? (
                              <Badge variant="outline" className="font-mono">
                                N/A
                              </Badge>
                            ) : (
                              <Badge
                                variant={getScoreBadgeVariant(rank)}
                                className="font-mono text-base px-3 py-1"
                              >
                                {score}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Legend:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Column headers:</strong> Show overall ranking (#1, #2, etc.) based on average 
              performance across all goals
            </li>
            <li>
              <strong>Cell badges:</strong> Show goal-specific ranking and score for each LLM tool
            </li>
            <li>
              <strong>Click any row:</strong> View detailed metrics and measurements for that goal
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

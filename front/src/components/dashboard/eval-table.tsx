'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Edit, ChevronDown, ChevronRight, Weight } from 'lucide-react';
import React, { useState } from 'react';
import type { Measurement as MeasurementType, EvaluationCriterion, LLMToolConfiguration, AggregatedScore, Measurement } from '@/lib/data';

// Helper: select latest measurement by date for a metric/tool
function selectLatestMeasurement(measurements: MeasurementType[], toolId: string, metricId: string): MeasurementType | undefined {
  const candidates = measurements.filter(m => m.llmToolConfigurationId === toolId && m.metricId === metricId);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  let latest = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (new Date(candidates[i].date) > new Date(latest.date)) {
      latest = candidates[i];
    }
  }
  return latest;
}

// Component for tool header cell
function ToolHeaderCell({ tool, onEditLlmTool }: Readonly<{ tool: LLMToolConfiguration; onEditLlmTool: (tool: LLMToolConfiguration) => void }>) {
  return (
    <div className="w-full flex flex-col items-center justify-start gap-0.5 group/header relative text-center pt-2 pb-3">
      <Badge variant="default" className="mx-auto text-xs font-medium px-1 py-0.5 bg-accent text-accent-foreground">
        {new Date(tool.timestamp).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })}
      </Badge>
      <span className="text-xl font-bold">{tool.toolName}</span>
      <span className="text-sm font-normal text-muted-foreground">{tool.modelVersion}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 absolute -top-1 -right-1 opacity-0 group-hover/header:opacity-100"
        onClick={() => onEditLlmTool(tool)}
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Component for criterion score cell
function CriterionScoreCell({ score }: Readonly<{ score: number | null }>) {
  return (
    <div className="text-center tabular-nums group/cell align-middle">
      {score === null ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <Badge variant="default" className="text-base">
          {score.toFixed(2)}%
        </Badge>
      )}
    </div>
  );
}

// Component for metric measurement cell
function MetricMeasurementCell({ 
  measurement, 
  isPercent, 
  toolId, 
  metricId, 
  metricName, 
  toolName, 
  onAddMeasurement 
}: Readonly<{ 
  measurement: Measurement | undefined; 
  isPercent: boolean; 
  toolId: string; 
  metricId: string; 
  metricName: string; 
  toolName: string;
  onAddMeasurement: (llmToolConfigId: string, metricId: string, metricName: string, toolName: string, existingMeasurement?: Measurement) => void;
}>) {
  return (
    <div className="text-center tabular-nums group/cell align-middle relative">
      {measurement ? (
        <Badge variant="secondary" className="text-base">
          {measurement.value}{isPercent ? '%' : ''}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
      <Button 
        variant="ghost" 
        size="icon" 
        className='h-6 w-6 opacity-0 group-hover/cell:opacity-100 absolute right-2 top-1/2 -translate-y-1/2' 
        onClick={() => onAddMeasurement(toolId, metricId, metricName, toolName, measurement)}
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Component for truncatable text with see more/see less
function TruncatableText({ text, maxLength = 100 }: Readonly<{ text: string; maxLength?: number }>) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= maxLength) return <span className="text-xs text-muted-foreground">{text}</span>;

  return (
    <div className="text-xs text-muted-foreground">
      {expanded ? (
        <>
          {text}{' '}
          <button onClick={() => setExpanded(false)} className="text-primary hover:underline whitespace-nowrap">see less</button>
        </>
      ) : (
        <>
          {text.slice(0, maxLength)}...{' '}
          <button onClick={() => setExpanded(true)} className="text-primary hover:underline whitespace-nowrap">see more</button>
        </>
      )}
    </div>
  );
}

// Component for overall score cell
function OverallScoreCell({ score }: Readonly<{ score: string }>) {
  return (
    <div className="text-center align-middle">
      {score === 'N/A' ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <Badge variant="default" className="text-base">
          {score}%
        </Badge>
      )}
    </div>
  );
}

interface EvalTableProps {
  criteria: EvaluationCriterion[];
  llmTools: LLMToolConfiguration[];
  scores: AggregatedScore[];
  measurements: Measurement[];
  onScoreUpdate: (scoreId: string, newScore: number) => void;
  onAddMeasurement: (llmToolConfigId: string, metricId: string, metricName: string, toolName: string, existingMeasurement?: Measurement) => void;
  onEditLlmTool: (tool: LLMToolConfiguration) => void;
}

export function EvalTable({ criteria, llmTools, scores, measurements, onScoreUpdate, onAddMeasurement, onEditLlmTool }: Readonly<EvalTableProps>) {
  const [openCriteria, setOpenCriteria] = useState<Record<string, boolean>>(
    criteria.reduce((acc, c) => ({ ...acc, [c.id]: true }), {})
  );

  const toggleCriterion = (id: string) => {
    setOpenCriteria(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Get aggregated score from backend for a criterion and tool configuration
  const getAggregatedScore = (criterionId: string, toolConfigId: string): number | null => {
    const score = scores.find(s => 
      s.criterionID === criterionId && s.toolConfigID === toolConfigId
    );
    
    if (!score || score.score === 'N/A') return null;
    return typeof score.score === 'number' ? score.score : null;
  };

  // Calculate overall aggregated score across all criteria
  const calculateOverallScore = (toolConfigID: string): string => {
    // Get the tool configuration to access its total_score
    const tool = llmTools.find(t => t.id === toolConfigID);
    
    // If the backend has calculated a total score, use it
    if (tool?.totalScore !== null && tool?.totalScore !== undefined) {
      return tool.totalScore.toFixed(2);
    }
    
    // Fallback: calculate from individual criterion scores (legacy behavior)
    let totalScore = 0;
    let count = 0;
    criteria.forEach(criterion => {
      const criterionScore = getAggregatedScore(criterion.id, toolConfigID);
      if (criterionScore !== null) {
        totalScore += criterionScore;
        count++;
      }
    });
    if (count === 0) return 'N/A';
    return totalScore.toFixed(2);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Evaluation Results</CardTitle>
        <CardDescription>
          Comparison of Large Language Models across various evaluation criteria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px] font-semibold text-base py-6">Evaluation Criterion / Metric</TableHead>
                <TableHead className="font-semibold text-base py-6">Weight</TableHead>
                {llmTools.map((tool) => (
                  <TableHead key={tool.id} className="text-center font-semibold text-base min-w-[200px] py-6">
                    <ToolHeaderCell tool={tool} onEditLlmTool={onEditLlmTool} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((criterion) => (
                <React.Fragment key={criterion.id}>
                  <TableRow 
                    className="bg-muted/20 hover:bg-muted/40 font-semibold"
                    >
                    <TableCell>
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => toggleCriterion(criterion.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleCriterion(criterion.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {openCriteria[criterion.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div>
                          <span>{criterion.dimension}</span>
                          {criterion.description && (
                            <TruncatableText text={criterion.description} />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <div className="flex items-center justify-center gap-1">
                        <Weight className="w-4 h-4 text-muted-foreground" /> {criterion.weight}
                      </div>
                    </TableCell>
                    {llmTools.map((tool) => {
                      const criterionScore = getAggregatedScore(criterion.id, tool.id);
                      return (
                        <TableCell key={tool.id}>
                          <CriterionScoreCell score={criterionScore} />
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {openCriteria[criterion.id] && criterion.metrics.map(metric => (
                    <TableRow key={metric.id} className="hover:bg-muted/10">
                      <TableCell className="pl-12">
                        <div>
                          <span className="font-medium">{metric.name}</span>
                          {metric.definition && (
                            <TruncatableText text={metric.definition} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <Weight className="w-3.5 h-3.5" /> {metric.weight}
                        </div>
                      </TableCell>
                        {llmTools.map((tool) => {
                           const measurement = selectLatestMeasurement(measurements, tool.id, metric.id);
                           const isPercent = metric.unit === 'Percent';
                           return (
                            <TableCell key={tool.id}>
                              <MetricMeasurementCell 
                                measurement={measurement}
                                isPercent={isPercent}
                                toolId={tool.id}
                                metricId={metric.id}
                                metricName={metric.name}
                                toolName={tool.toolName}
                                onAddMeasurement={onAddMeasurement}
                              />
                            </TableCell>
                           )
                        })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
                <TableRow className="bg-muted/50 font-bold text-base">
                  <TableCell colSpan={2}>Overall Score</TableCell>
                  {llmTools.map(tool => {
                    const overallScore = calculateOverallScore(tool.id);
                    return (
                      <TableCell key={tool.id}>
                        <OverallScoreCell score={overallScore} />
                      </TableCell>
                    )
                  })}
                </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

    
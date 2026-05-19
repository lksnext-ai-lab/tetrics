'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AdminOnlyButton } from '@/components/ui/admin-only-button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { EvaluationProgram, Goal, EvaluationCriterion } from '@/lib/data';

interface EditContextSheetProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly evaluationProgram: EvaluationProgram | null;
  readonly goal: Goal | null;
  readonly criteria: EvaluationCriterion[];
  readonly onSave: (
    updatedProgram: EvaluationProgram, 
    updatedGoal: Goal, 
    updatedCriteria: EvaluationCriterion[]
  ) => void;
  readonly onAddCriterion?: () => void;
  readonly onAddMetric?: (criterionId: string) => void;
  readonly canEdit?: boolean;
}

export function EditContextSheet({
  isOpen,
  onOpenChange,
  evaluationProgram,
  goal,
  criteria,
  onSave,
  onAddCriterion,
  onAddMetric,
  canEdit = true,
}: EditContextSheetProps) {
  // Local state for form inputs
  const [orgContext, setOrgContext] = useState('');
  const [timePeriod, setTimePeriod] = useState('');
  const [responsibleTeam, setResponsibleTeam] = useState('');
  const [purpose, setPurpose] = useState('');
  const [focus, setFocus] = useState('');
  const [viewpoint, setViewpoint] = useState('');
  const [context, setContext] = useState('');
  const [editedCriteria, setEditedCriteria] = useState<EvaluationCriterion[]>([]);

  // Update local state when props change
  useEffect(() => {
    if (evaluationProgram) {
      setOrgContext(evaluationProgram.organizationContext);
      setTimePeriod(evaluationProgram.timePeriod);
      setResponsibleTeam(evaluationProgram.responsibleTeam);
    }
    if (goal) {
      setPurpose(goal.purpose);
      setFocus(goal.focus);
      setViewpoint(goal.viewpoint);
      setContext(goal.context || '');
    }
    if (criteria) {
      // Prefer structuredClone when available, fallback to JSON deep clone
      // to avoid mutating the incoming props.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clone = (typeof (globalThis as any).structuredClone === 'function')
        ? (globalThis as any).structuredClone(criteria)
        : (
          // Fallback for environments without structuredClone. We intentionally
          // allow JSON deep-clone here; disable the structuredClone lint rule.
          // eslint-disable-next-line unicorn/prefer-structured-clone
          JSON.parse(JSON.stringify(criteria))
        );
      setEditedCriteria(clone);
    }
  }, [evaluationProgram, goal, criteria]);

  // Helper functions to update criteria and metrics
  const updateCriterion = (criterionId: string, field: keyof EvaluationCriterion, value: any) => {
    setEditedCriteria(prev =>
      prev.map(c =>
        c.id === criterionId ? { ...c, [field]: value } : c
      )
    );
  };

  const updateMetric = (criterionId: string, metricId: string, field: string, value: any) => {
    setEditedCriteria((prev) => {
      const result: EvaluationCriterion[] = [];
      for (const c of prev) {
        if (c.id !== criterionId) {
          result.push(c);
          continue;
        }

        // build new metrics array without nested arrow functions
        const newMetrics = [] as typeof c.metrics;
        for (const m of c.metrics) {
          if (m.id === metricId) {
            newMetrics.push({ ...m, [field]: value });
          } else {
            newMetrics.push(m);
          }
        }

        result.push({ ...c, metrics: newMetrics });
      }
      return result;
    });
  };

  // Enum-backed options (keep in sync with backend enums)
  const aggregationOptions = [
    'weighted_average',
    'weighted_sum_normalized',
    'direct_metric_weights',
    'custom',
  ];

  const scaleTypeOptions = ['nominal', 'ordinal', 'interval', 'ratio'];
  const normalizationOptions = ['none', 'max', 'min'];

  const directionOptions = ['maximize', 'minimize'];
  const unitOptions = ['Percent', 'Cardinal'];

  const handleSave = () => {
    if (!evaluationProgram || !goal) return;

    const updatedProgram: EvaluationProgram = {
      ...evaluationProgram,
      organizationContext: orgContext,
      timePeriod: timePeriod,
      responsibleTeam: responsibleTeam,
    };

    const updatedGoal: Goal = {
      ...goal,
      purpose: purpose,
      focus: focus,
      viewpoint: viewpoint,
      context: context,
    };

    onSave(updatedProgram, updatedGoal, editedCriteria);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">Edit Evaluation Context</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Define the global parameters for this evaluation program.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 space-y-8">
          {/* Evaluation Program Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-xl font-bold">Evaluation Program</h3>
            <div className="grid gap-2">
              <Label htmlFor="org-context">Organization Context</Label>
              <Input
                id="org-context"
                value={orgContext}
                onChange={(e) => setOrgContext(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time-period">Time Period</Label>
              <Input 
                id="time-period" 
                type="datetime-local"
                value={timePeriod ? new Date(timePeriod).toISOString().slice(0, 16) : ''}
                onChange={(e) => setTimePeriod(e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="responsible-team">Responsible Team</Label>
              <Input
                id="responsible-team"
                value={responsibleTeam}
                onChange={(e) => setResponsibleTeam(e.target.value)}
              />
            </div>
          </div>

          {/* Goal Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-xl font-bold">Goal</h3>
            <div className="grid gap-2">
              <Label htmlFor="goal-purpose">Purpose</Label>
              <Input
                id="goal-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-focus">Focus</Label>
              <Input 
                id="goal-focus" 
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-viewpoint">Viewpoint</Label>
              <Input 
                id="goal-viewpoint" 
                value={viewpoint}
                onChange={(e) => setViewpoint(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-context">Context (Markdown)</Label>
              <Textarea
                id="goal-context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {/* Criteria and Metrics Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Criteria and Metrics</h3>
              {onAddCriterion && (
                <AdminOnlyButton
                  allowed={canEdit}
                  tooltip="Admin role required to add criteria."
                  variant="outline"
                  size="sm"
                  onClick={onAddCriterion}
                >
                  + Add Criterion
                </AdminOnlyButton>
              )}
            </div>
            <Accordion type="multiple" defaultValue={editedCriteria.map(c => c.id)} className="w-full">
              {editedCriteria.map((criterion) => (
                <AccordionItem value={criterion.id} key={criterion.id}>
                  <AccordionTrigger className="text-lg font-semibold">{criterion.dimension}</AccordionTrigger>
                  <AccordionContent className="space-y-6 pl-2">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={criterion.description}
                        onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Weight</Label>
                        <Input
                          type="number"
                          value={Number.isNaN(criterion.weight) ? '' : criterion.weight}
                          onChange={(e) => updateCriterion(criterion.id, 'weight', Number.parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Aggregation</Label>
                        <div>
                          <Select
                            value={criterion.aggregationStrategy}
                            onValueChange={(v) => updateCriterion(criterion.id, 'aggregationStrategy', v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {aggregationOptions.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <h4 className="text-base font-semibold">Metrics</h4>
                      {onAddMetric && (
                        <AdminOnlyButton
                          allowed={canEdit}
                          tooltip="Admin role required to add metrics."
                          variant="ghost"
                          size="sm"
                          onClick={() => onAddMetric(criterion.id)}
                        >
                          + Add Metric
                        </AdminOnlyButton>
                      )}
                    </div>
                    <div className="space-y-4 pl-4 border-l">
                      {criterion.metrics.map(metric => (
                        <div key={metric.id} className="flex">
                          <div className="w-1 bg-primary-500 rounded-l-md mr-3" />
                          <div className="flex-1 space-y-2 border p-3 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                            <Label className="font-medium">{metric.name}</Label>
                             <Textarea
                               value={metric.definition}
                               onChange={(e) => updateMetric(criterion.id, metric.id, 'definition', e.target.value)}
                               rows={2}
                             />
                           {/* Field grid: small labels above each control */}
                           <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Unit</p>
                                <Select
                                  value={metric.unit}
                                  onValueChange={(v) => updateMetric(criterion.id, metric.id, 'unit', v)}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Percent">Percentage (e.g., 85%)</SelectItem>
                                    <SelectItem value="Cardinal">Count (e.g., 3 errors)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Normalize</p>
                                <Select
                                  value={metric.normalizationMethod}
                                  onValueChange={(v) => updateMetric(criterion.id, metric.id, 'normalizationMethod', v)}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None (raw value)</SelectItem>
                                    <SelectItem value="max">Max (value ÷ max)</SelectItem>
                                    <SelectItem value="min">Min (value ÷ min)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Scale</p>
                                <Select
                                  value={metric.scaleType}
                                  onValueChange={(v) => updateMetric(criterion.id, metric.id, 'scaleType', v)}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ratio">Ratio (zero=absence)</SelectItem>
                                    <SelectItem value="interval">Interval</SelectItem>
                                    <SelectItem value="ordinal">Ordinal (rank)</SelectItem>
                                    <SelectItem value="nominal">Nominal (category)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Target</p>
                                <Input
                                  placeholder="Optional"
                                  className="h-8 text-xs"
                                  type="number"
                                  value={Number.isNaN(metric.targetValue) ? '' : metric.targetValue}
                                  onChange={(e) => updateMetric(criterion.id, metric.id, 'targetValue', Number.parseFloat(e.target.value))}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Goal</p>
                                <Select
                                  value={metric.direction}
                                  onValueChange={(v) => updateMetric(criterion.id, metric.id, 'direction', v)}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="maximize">Higher is better</SelectItem>
                                    <SelectItem value="minimize">Lower is better</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-0.5">Weight</p>
                                <Input
                                  placeholder="1.0"
                                  className="h-8 text-xs"
                                  type="number"
                                  step="0.1"
                                  value={Number.isNaN(metric.weight) ? '' : metric.weight}
                                  onChange={(e) => updateMetric(criterion.id, metric.id, 'weight', Number.parseFloat(e.target.value))}
                                />
                              </div>
                  </div>
                  </div>
                </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <AdminOnlyButton
            allowed={canEdit}
            tooltip="Admin role required to save changes."
            onClick={handleSave}
            type="submit"
          >
            Save Changes
          </AdminOnlyButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

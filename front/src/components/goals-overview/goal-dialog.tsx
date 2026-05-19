'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from '@/components/ui/tag-input';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Goal, EvaluationProgram } from '@/lib/data';

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
  evaluationProgram?: EvaluationProgram | null;
  onSuccess: () => void;
}

export function GoalDialog({ 
  open, 
  onOpenChange, 
  goal, 
  evaluationProgram,
  onSuccess 
}: Readonly<GoalDialogProps>) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Goal form state
  const [purpose, setPurpose] = useState('');
  const [focus, setFocus] = useState('');
  const [viewpoint, setViewpoint] = useState('');
  const [context, setContext] = useState('');
  
  // Evaluation program form state (only for new goals)
  const [organizationContext, setOrganizationContext] = useState('');
  const [timePeriod, setTimePeriod] = useState('');
  const [responsibleTeam, setResponsibleTeam] = useState('');
  const [validityPeriod, setValidityPeriod] = useState('');
  const [reevaluationTriggers, setReevaluationTriggers] = useState<string[]>([]);

  // Initialize form with existing goal data if editing
  useEffect(() => {
    if (goal) {
      setPurpose(goal.purpose || '');
      setFocus(goal.focus || '');
      setViewpoint(goal.viewpoint || '');
      setContext(goal.context || '');
    } else {
      setPurpose('');
      setFocus('');
      setViewpoint('');
      setContext('');
    }
  }, [goal]);

  // Initialize evaluation program data if available
  useEffect(() => {
    if (evaluationProgram) {
      setOrganizationContext(evaluationProgram.organizationContext || '');
      // Extract date from timePeriod string if it's an ISO date
      const timePeriodStr = evaluationProgram.timePeriod || '';
      try {
        const date = new Date(timePeriodStr);
        if (Number.isNaN(date.getTime())) {
          setTimePeriod('');
        } else {
          setTimePeriod(date.toISOString().split('T')[0]);
        }
      } catch {
        setTimePeriod('');
      }
      setResponsibleTeam(evaluationProgram.responsibleTeam || '');
      setValidityPeriod(evaluationProgram.validityPeriod?.toString() || '');
      setReevaluationTriggers(evaluationProgram.reevaluationTriggers || []);
    } else {
      setOrganizationContext('');
      setTimePeriod('');
      setResponsibleTeam('');
      setValidityPeriod('');
      setReevaluationTriggers([]);
    }
  }, [evaluationProgram]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let programId = evaluationProgram?.id;

      // Create evaluation program if this is a new goal without an existing program
      if (!goal && !evaluationProgram) {
        if (!organizationContext || !timePeriod || !responsibleTeam) {
          toast({
            title: 'Validation Error',
            description: 'Please fill in all evaluation program fields.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        // Convert date to ISO datetime string
        const timePeriodDate = new Date(timePeriod);
        const timePeriodISO = timePeriodDate.toISOString();
        
        const newProgram = await api.evaluationPrograms.create({
          organization_context: organizationContext,
          time_period: timePeriodISO,
          responsible_team: responsibleTeam,
          validity_period: validityPeriod ? Number.parseInt(validityPeriod, 10) : undefined,
          reevaluation_triggers: reevaluationTriggers.length > 0 ? reevaluationTriggers : undefined,
        });
        programId = newProgram.id;
      }

      // Validate goal fields
      if (!purpose || !focus || !viewpoint) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required goal fields.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const goalData = {
        purpose,
        focus,
        viewpoint,
        context: context || undefined,
        evaluation_program_id: programId,
      };

      if (goal) {
        // Update existing goal only
        await api.goals.update(goal.id, goalData);

        toast({
          title: 'Success',
          description: 'Goal updated successfully.',
        });
      } else {
        // Create new goal
        await api.goals.create(goalData);
        toast({
          title: 'Success',
          description: 'Goal created successfully.',
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving goal:', error);
      let errorMessage = `Failed to ${goal ? 'update' : 'create'} goal. Please try again.`;
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Evaluation Program Section - only show for new goals (no existing program) */}
            {!goal && !evaluationProgram && (
              <div className="space-y-4 pb-4 border-b">
                <h3 className="text-lg font-semibold">Evaluation Program</h3>
                <p className="text-sm text-muted-foreground">
                  Every goal needs an evaluation program. Fill in the details below.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="organizationContext">
                    Organization Context <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="organizationContext"
                    value={organizationContext}
                    onChange={(e) => setOrganizationContext(e.target.value)}
                    placeholder="Describe the organizational context..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timePeriod">
                    Time Period <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="timePeriod"
                    type="date"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsibleTeam">
                    Responsible Team <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="responsibleTeam"
                    type="text"
                    value={responsibleTeam}
                    onChange={(e) => setResponsibleTeam(e.target.value)}
                    placeholder="e.g., Engineering Team"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validityPeriod">
                    Validity Period (days)
                  </Label>
                  <Input
                    id="validityPeriod"
                    type="number"
                    min="1"
                    value={validityPeriod}
                    onChange={(e) => setValidityPeriod(e.target.value)}
                    placeholder="e.g., 90 for 3 months"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reevaluationTriggers">
                    Reevaluation Triggers
                  </Label>
                  <TagInput
                    value={reevaluationTriggers}
                    onChange={setReevaluationTriggers}
                    placeholder="Type a trigger and press Enter (e.g., 'major tool release')..."
                  />
                </div>
              </div>
            )}

            {/* Goal Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Goal Details</h3>
              <div className="space-y-2">
                <Label htmlFor="purpose">
                  Purpose <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What is the purpose of this goal?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="focus">
                  Focus <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="focus"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="What is the focus of this goal?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="viewpoint">
                  Viewpoint <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="viewpoint"
                  value={viewpoint}
                  onChange={(e) => setViewpoint(e.target.value)}
                  placeholder="From what viewpoint is this goal evaluated?"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="context">Context (Optional)</Label>
                <Textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Additional context for this goal..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {(() => {
                if (isSubmitting) return 'Saving...';
                if (goal) return 'Update Goal';
                return 'Create Goal';
              })()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

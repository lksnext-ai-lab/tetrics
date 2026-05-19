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
import type { EvaluationProgram } from '@/lib/data';

interface ProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationProgram: EvaluationProgram | null;
  onSuccess: () => void;
}

export function ProgramDialog({
  open,
  onOpenChange,
  evaluationProgram,
  onSuccess,
}: Readonly<ProgramDialogProps>) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [organizationContext, setOrganizationContext] = useState('');
  const [timePeriod, setTimePeriod] = useState('');
  const [responsibleTeam, setResponsibleTeam] = useState('');
  const [validityPeriod, setValidityPeriod] = useState('');
  const [reevaluationTriggers, setReevaluationTriggers] = useState<string[]>([]);

  useEffect(() => {
    if (evaluationProgram) {
      setOrganizationContext(evaluationProgram.organizationContext || '');
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
    }
  }, [evaluationProgram]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluationProgram) return;

    if (!organizationContext || !timePeriod || !responsibleTeam) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const timePeriodDate = new Date(timePeriod);
      const timePeriodISO = timePeriodDate.toISOString();

      await api.evaluationPrograms.update(evaluationProgram.id, {
        organization_context: organizationContext,
        time_period: timePeriodISO,
        responsible_team: responsibleTeam,
        validity_period: validityPeriod ? Number.parseInt(validityPeriod, 10) : undefined,
        reevaluation_triggers: reevaluationTriggers.length > 0 ? reevaluationTriggers : undefined,
      });

      toast({
        title: 'Success',
        description: 'Evaluation program updated successfully.',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating evaluation program:', error);
      let errorMessage = 'Failed to update evaluation program. Please try again.';
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
          <DialogTitle>Edit Evaluation Program</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
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
              <Label htmlFor="validityPeriod">Validity Period (days)</Label>
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
              <Label htmlFor="reevaluationTriggers">Reevaluation Triggers</Label>
              <TagInput
                value={reevaluationTriggers}
                onChange={setReevaluationTriggers}
                placeholder="Type a trigger and press Enter (e.g., 'major tool release')..."
              />
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
              {isSubmitting ? 'Saving...' : 'Update Program'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api, formatApiError } from '@/lib/api';
import type { EvaluationCriterion } from '@/lib/data';

interface AddCriterionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  criterion?: EvaluationCriterion | null;
  onSuccess: () => void;
}

export function AddCriterionDialog({ 
  open, 
  onOpenChange, 
  goalId,
  criterion,
  onSuccess 
}: Readonly<AddCriterionDialogProps>) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [dimension, setDimension] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('1.0');
  const [aggregationStrategy, setAggregationStrategy] = useState<'weighted_average' | 'weighted_sum_normalized' | 'direct_metric_weights' | 'custom'>('weighted_average');

  useEffect(() => {
    if (criterion) {
      setDimension(criterion.dimension || '');
      setDescription(criterion.description || '');
      setWeight(criterion.weight.toString());
      setAggregationStrategy(criterion.aggregationStrategy);
    } else {
      setDimension('');
      setDescription('');
      setWeight('1.0');
      setAggregationStrategy('weighted_average');
    }
  }, [criterion, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!dimension || !description) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const weightNum = parseFloat(weight);
      if (isNaN(weightNum) || weightNum <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Weight must be a positive number.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const criterionData = {
        dimension,
        description,
        weight: weightNum,
        aggregation_strategy: aggregationStrategy,
        goal_id: goalId,
      };

      if (criterion) {
        await api.evaluationCriteria.update(criterion.id, criterionData);
        toast({
          title: 'Success',
          description: 'Evaluation criterion updated successfully.',
        });
      } else {
        await api.evaluationCriteria.create(criterionData);
        toast({
          title: 'Success',
          description: 'Evaluation criterion created successfully.',
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving criterion:', error);
      const errorMessage = formatApiError(
        error,
        `Failed to ${criterion ? 'update' : 'create'} evaluation criterion. Please try again.`
      );
      
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{criterion ? 'Edit Evaluation Criterion' : 'Add Evaluation Criterion'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dimension">
                Dimension <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dimension"
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
                placeholder="e.g., Accuracy, Efficiency, Creativity"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this criterion evaluates..."
                required
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">
                Weight <span className="text-destructive">*</span>
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The relative importance of this criterion (higher = more important)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aggregationStrategy">
                Aggregation Strategy <span className="text-destructive">*</span>
              </Label>
              <Select value={aggregationStrategy} onValueChange={(value: any) => setAggregationStrategy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weighted_average">Weighted Average</SelectItem>
                  <SelectItem value="weighted_sum_normalized">Weighted Sum Normalized</SelectItem>
                  <SelectItem value="direct_metric_weights">Direct Metric Weights</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How metric scores are combined for this criterion
              </p>
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
              {isSubmitting ? 'Saving...' : criterion ? 'Update Criterion' : 'Create Criterion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

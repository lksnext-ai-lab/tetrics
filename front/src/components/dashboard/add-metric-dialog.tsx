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
import type { Metric } from '@/lib/data';

interface AddMetricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criterionId: string;
  metric?: Metric | null;
  onSuccess: () => void;
}

export function AddMetricDialog({ 
  open, 
  onOpenChange, 
  criterionId,
  metric,
  onSuccess 
}: Readonly<AddMetricDialogProps>) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState('');
  const [unit, setUnit] = useState('Percent');
  const [scaleType, setScaleType] = useState<'nominal' | 'ordinal' | 'interval' | 'ratio'>('ratio');
  const [collectionMethod, setCollectionMethod] = useState<'automated' | 'manual' | 'hybrid'>('manual');
  const [normalizationMethod, setNormalizationMethod] = useState<'none' | 'max' | 'min'>('none');
  const [weight, setWeight] = useState('1.0');
  const [targetValue, setTargetValue] = useState('');
  const [direction, setDirection] = useState<'maximize' | 'minimize'>('maximize');

  useEffect(() => {
    if (metric) {
      setName(metric.name || '');
      setDefinition(metric.definition || '');
      setUnit(metric.unit || 'Percent');
      setScaleType(metric.scaleType);
      setCollectionMethod(metric.collectionMethod as 'automated' | 'manual' | 'hybrid');
      setNormalizationMethod(metric.normalizationMethod || 'none');
      setWeight(metric.weight.toString());
      setTargetValue(metric.targetValue?.toString() || '');
      setDirection(metric.direction);
    } else {
      setName('');
      setDefinition('');
      setUnit('Percent');
      setScaleType('ratio');
      setCollectionMethod('manual');
      setNormalizationMethod('none');
      setWeight('1.0');
      setTargetValue('');
      setDirection('maximize');
    }
  }, [metric, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!name || !definition || !unit) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const weightNum = parseFloat(weight);
      if (isNaN(weightNum)) {
        toast({
          title: 'Validation Error',
          description: 'Weight must be a valid number.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const targetValueNum = targetValue ? parseFloat(targetValue) : null;
      if (targetValue && isNaN(targetValueNum!)) {
        toast({
          title: 'Validation Error',
          description: 'Target value must be a valid number.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const metricData = {
        name,
        definition,
        unit,
        scale_type: scaleType,
        collection_method: collectionMethod,
        normalization_method: normalizationMethod,
        weight: weightNum,
        target_value: targetValueNum,
        direction: direction === 'maximize' ? 'higher_is_better' : 'lower_is_better',
        evaluation_criterion_id: criterionId,
      };

      if (metric) {
        await api.metrics.update(metric.id, metricData);
        toast({
          title: 'Success',
          description: 'Metric updated successfully.',
        });
      } else {
        await api.metrics.create(metricData);
        toast({
          title: 'Success',
          description: 'Metric created successfully.',
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving metric:', error);
      const errorMessage = formatApiError(
        error,
        `Failed to ${metric ? 'update' : 'create'} metric. Please try again.`
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{metric ? 'Edit Metric' : 'Add Metric'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* ---- What to measure ---- */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Response Accuracy, Avg Latency, Error Count"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="definition">
                Definition <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="definition"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Describe exactly how this metric is measured. e.g., Percentage of responses that match the expected answer."
                required
                rows={3}
              />
            </div>

            {/* ---- Measurement type ---- */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">
                  Unit <span className="text-destructive">*</span>
                </Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Percent">Percentage (e.g., 85% accuracy)</SelectItem>
                    <SelectItem value="Cardinal">Count (e.g., 3 errors, 250ms latency)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  What kind of number does this metric produce?
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="collectionMethod">
                  Collection Method <span className="text-destructive">*</span>
                </Label>
                <Select value={collectionMethod} onValueChange={(value: any) => setCollectionMethod(value)}>
                  <SelectTrigger id="collectionMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automated">Automated (scripted/CI)</SelectItem>
                    <SelectItem value="manual">Manual (human judgment)</SelectItem>
                    <SelectItem value="hybrid">Hybrid (auto + manual review)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How is the measurement data gathered?
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scaleType">
                Measurement Scale <span className="text-destructive">*</span>
              </Label>
              <Select value={scaleType} onValueChange={(value: any) => setScaleType(value)}>
                <SelectTrigger id="scaleType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ratio">Ratio — zero means none (e.g., latency, count)</SelectItem>
                  <SelectItem value="interval">Interval — arbitrary zero (e.g., temperature)</SelectItem>
                  <SelectItem value="ordinal">Ordinal — ranked order (e.g., 1st/2nd/3rd)</SelectItem>
                  <SelectItem value="nominal">Nominal — categories only (e.g., pass/fail)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Statistical scale type of the measurement. Most metrics are Ratio.
              </p>
            </div>

            {/* ---- Scoring ---- */}
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-semibold text-muted-foreground">Scoring Configuration</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="normalizationMethod">
                Normalize Values
              </Label>
              <Select value={normalizationMethod} onValueChange={(value: any) => setNormalizationMethod(value)}>
                <SelectTrigger id="normalizationMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No normalization — use raw value as-is</SelectItem>
                  <SelectItem value="max">Divide by the maximum — value ÷ max across all tools</SelectItem>
                  <SelectItem value="min">Divide by the minimum — value ÷ min across all tools</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How should the raw measurement be scaled before entering the score formula?
                Choose "No normalization" for percentages that are already in a sensible range,
                or "Divide by max/min" when comparing counts across tools of different scales.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">
                  Weight <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Contribution strength. Positive = reward, negative = penalty.
                  Determines how much this metric pulls the total score up or down.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetValue">
                  Target Value
                </Label>
                <Input
                  id="targetValue"
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g., 95"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. The ideal value this metric should reach.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">
                Goal Direction
              </Label>
              <Select value={direction} onValueChange={(value: any) => setDirection(value)}>
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maximize">Higher is better (e.g., accuracy, throughput)</SelectItem>
                  <SelectItem value="minimize">Lower is better (e.g., errors, latency)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Whether the goal is to push this metric up or down. This is metadata
                — scoring is controlled by your weight sign (positive/negative).
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
              {isSubmitting ? 'Saving...' : metric ? 'Update Metric' : 'Create Metric'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

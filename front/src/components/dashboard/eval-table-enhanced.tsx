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
import { AdminOnlyButton } from '@/components/ui/admin-only-button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, ChevronDown, ChevronRight, Weight, ArrowRightLeft, Settings2, GripVertical, Plus } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Measurement as MeasurementType, EvaluationCriterion, LLMToolConfiguration, AggregatedScore, Measurement, Metric } from '@/lib/data';

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
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type VisibilityState,
} from '@tanstack/react-table';

interface EvalTableProps {
  criteria: EvaluationCriterion[];
  llmTools: LLMToolConfiguration[];
  scores: AggregatedScore[];
  measurements: Measurement[];
  onScoreUpdate: (scoreId: string, newScore: number) => void;
  onAddMeasurement: (llmToolConfigId: string, metricId: string, metricName: string, toolName: string, existingMeasurement?: Measurement) => void;
  onEditLlmTool: (tool: LLMToolConfiguration) => void;
  /** If true, table is showing a single goal; overall score should be computed only from provided criteria and ignore global totalScore from backend. */
  scopedToSingleGoal?: boolean;
  canEditTools?: boolean;
  /** Open the add criterion dialog */
  onAddCriterion?: () => void;
  /** Open the edit criterion dialog */
  onEditCriterion?: (criterion: EvaluationCriterion) => void;
  /** Open the add metric dialog for a criterion */
  onAddMetric?: (criterionId: string) => void;
  /** Open the edit metric dialog */
  onEditMetric?: (metric: Metric, criterionId: string) => void;
  /** Save a criterion field update (weight, aggregationStrategy) */
  onUpdateCriterion?: (criterionId: string, field: 'weight' | 'aggregationStrategy', value: number | string) => void;
  /** Save a metric field update (weight) */
  onUpdateMetric?: (criterionId: string, metricId: string, field: 'weight', value: number) => void;
}

// Flatten structure for table rows
type TableRow = {
  id: string;
  type: 'criterion' | 'metric';
  criterion?: EvaluationCriterion;
  metric?: EvaluationCriterion['metrics'][0];
  criterionId?: string;
};

function ExpandableDescription({ text }: Readonly<{ text: string }>) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="text-xs text-muted-foreground hover:text-foreground font-normal"
      >
        {show ? 'Hide description' : 'Show description'}
      </button>
      {show && <div className="text-xs text-muted-foreground mt-0.5 font-normal">{text}</div>}
    </div>
  );
}

function InlineWeightInput({ value, onSave, className }: { value: number; onSave: (value: number) => void; className?: string }) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const commit = useCallback((raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed !== value) {
      onSave(parsed);
    } else if (isNaN(parsed)) {
      setLocalValue(value.toString());
    }
  }, [value, onSave]);

  const charWidth = Math.max(localValue.length + 1, 4);

  return (
    <Input
      type="number"
      step="0.1"
      className={`h-7 text-xs ${className || ''}`}
      style={{ width: `calc(${charWidth}ch + 3rem)` }}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => commit(localValue)}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(localValue); }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

const AGGREGATION_OPTIONS = [
  { value: 'weighted_average', label: 'Weighted Avg' },
  { value: 'weighted_sum_normalized', label: 'Weighted Sum Norm' },
  { value: 'direct_metric_weights', label: 'Direct Metric' },
  { value: 'custom', label: 'Custom' },
];

export function EvalTableEnhanced({ criteria, llmTools, scores, measurements, onScoreUpdate, onAddMeasurement, onEditLlmTool, scopedToSingleGoal = false, canEditTools = true, onAddCriterion, onEditCriterion, onAddMetric, onEditMetric, onUpdateCriterion, onUpdateMetric }: Readonly<EvalTableProps>) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    criteria.reduce((acc, c) => ({ ...acc, [c.id]: true }), {} as Record<string, boolean>)
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [criteriaOrder, setCriteriaOrder] = useState<string[]>([]);
  const [metricOrders, setMetricOrders] = useState<Record<string, string[]>>({});
  const [draggedRow, setDraggedRow] = useState<string | null>(null);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);

  // Get aggregated score from backend for a criterion and tool configuration
  const getAggregatedScore = useCallback((criterionId: string, toolConfigId: string): number | null => {
    const score = scores.find(s => s.criterionID === criterionId && s.toolConfigID === toolConfigId);
    if (score && score.score !== 'N/A') {
      return typeof score.score === 'number' ? score.score : null;
    }
    // Fallback: compute client-side if missing from backend
    const criterion = criteria.find(c => c.id === criterionId);
    if (!criterion) return null;
    const relevantMeasurements = measurements.filter(m => m.llmToolConfigurationId === toolConfigId && criterion.metrics.some(mt => mt.id === m.metricId));
    if (relevantMeasurements.length === 0) return null;
    const measurementMap = new Map<string, typeof relevantMeasurements[0]>();
    for (const m of relevantMeasurements) measurementMap.set(m.metricId, m);
    let weightedSum = 0;
    let weightTotal = 0;
    for (const metric of criterion.metrics) {
      const m = measurementMap.get(metric.id);
      if (!m) continue;
      const value = (m.normalizedValue !== null && m.normalizedValue !== undefined)
        ? m.normalizedValue
        : m.value;
      weightedSum += value * metric.weight;
      weightTotal += metric.weight;
    }
    if (weightTotal === 0) return null;
    if (criterion.aggregationStrategy === 'weighted_average') {
      return (weightedSum / weightTotal) * criterion.weight;
    }
    if (criterion.aggregationStrategy === 'direct_metric_weights') {
      return weightedSum;
    }
    return weightedSum * criterion.weight;
  }, [criteria, scores, measurements]);

  // Calculate overall aggregated score across all criteria
  const calculateOverallScore = useCallback((toolConfigID: string): string => {
    const tool = llmTools.find(t => t.id === toolConfigID);
    if (!scopedToSingleGoal && tool?.totalScore !== null && tool?.totalScore !== undefined) {
      return tool.totalScore.toFixed(2);
    }
    let sum = 0;
    let any = false;
    for (const criterion of criteria) {
      const criterionScore = getAggregatedScore(criterion.id, toolConfigID);
      if (criterionScore !== null) {
        sum += criterionScore;
        any = true;
      }
    }
    if (!any) return 'N/A';
    return sum.toFixed(2);
  }, [criteria, llmTools, scopedToSingleGoal, getAggregatedScore]);

  // Flatten data structure for react-table
  const tableData = useMemo(() => {
    const rows: TableRow[] = [];

    const orderedCriteria = criteriaOrder.length > 0
      ? criteriaOrder.map(id => criteria.find(c => c.id === id)).filter(Boolean) as EvaluationCriterion[]
      : criteria;

    for (const criterion of orderedCriteria) {
      rows.push({
        id: criterion.id,
        type: 'criterion',
        criterion,
      });

      const orderedMetrics = metricOrders[criterion.id]
        ? metricOrders[criterion.id].map(metricId => criterion.metrics.find(m => m.id === metricId)).filter(Boolean) as typeof criterion.metrics
        : criterion.metrics;

      for (const metric of orderedMetrics) {
        rows.push({
          id: `${criterion.id}-${metric.id}`,
          type: 'metric',
          metric,
          criterionId: criterion.id,
        });
      }
    }
    return rows;
  }, [criteria, criteriaOrder, metricOrders]);

  // Define columns
  const columns = useMemo<ColumnDef<TableRow>[]>(() => [
    {
      id: 'criterion-metric',
      header: 'Evaluation Criterion / Metric',
      cell: ({ row }) => {
        const data = row.original;
        if (data.type === 'criterion' && data.criterion) {
          const isExpanded = expanded[data.criterion.id];
          const toggleExpanded = () => {
            setExpanded(prev => ({ ...prev, [data.criterion!.id]: !prev[data.criterion!.id] }));
          };
          return (
            <div className="flex items-center gap-2 font-semibold group/criterion">
              <span
                className="flex items-center gap-2 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={toggleExpanded}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpanded();
                  }
                }}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <span>{data.criterion.dimension}</span>
                  {data.criterion.description && (
                    <ExpandableDescription text={data.criterion.description} />
                  )}
                </div>
              </span>
              {canEditTools && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/criterion:opacity-100 transition-opacity">
                  <AdminOnlyButton
                    allowed={canEditTools}
                    tooltip="Edit criterion"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); onEditCriterion?.(data.criterion!); }}
                  >
                    <Edit className="h-3 w-3" />
                  </AdminOnlyButton>
                  {onAddMetric && (
                    <AdminOnlyButton
                      allowed={canEditTools}
                      tooltip="Admin role required to add metrics."
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); onAddMetric(data.criterion!.id); }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add New Metric
                    </AdminOnlyButton>
                  )}
                </div>
              )}
            </div>
          );
        } else if (data.type === 'metric' && data.metric) {
          return (
            <div className="flex items-center gap-2 group/metric">
              <div>
                <span className="font-medium">{data.metric.name}</span>
                {data.metric.definition && (
                  <ExpandableDescription text={data.metric.definition} />
                )}
              </div>
              {canEditTools && (
                <AdminOnlyButton
                  allowed={canEditTools}
                  tooltip="Edit metric"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover/metric:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onEditMetric?.(data.metric!, data.criterionId!); }}
                >
                  <Edit className="h-3 w-3" />
                </AdminOnlyButton>
              )}
            </div>
          );
        }
        return null;
      },
      size: 300,
      enableHiding: false,
    },
    {
      id: 'weight',
      header: 'Weight',
      cell: ({ row }) => {
        const data = row.original;
        if (data.type === 'criterion' && data.criterion) {
          const isDirectMetric = data.criterion.aggregationStrategy === 'direct_metric_weights';
          return (
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {!isDirectMetric && (
                  <>
                    <Weight className="w-4 h-4" />
                    <InlineWeightInput
                      value={data.criterion.weight}
                      onSave={(newWeight) => onUpdateCriterion?.(data.criterion!.id, 'weight', newWeight)}
                    />
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <Select
                  value={data.criterion.aggregationStrategy}
                  onValueChange={(v) => onUpdateCriterion?.(data.criterion!.id, 'aggregationStrategy', v)}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs" onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        } else if (data.type === 'metric' && data.metric) {
          const criterion = criteria.find(c => c.id === data.criterionId);
          const strategy = criterion?.aggregationStrategy;
          if (strategy === 'weighted_average') {
            return null;
          }
          const isDirectMetric = strategy === 'direct_metric_weights';
          return (
            <div className="flex items-center justify-center gap-1">
              <Weight className="w-3.5 h-3.5 text-muted-foreground" />
              {isDirectMetric ? (
                <InlineWeightInput
                  value={data.metric.weight}
                  onSave={(newWeight) => onUpdateMetric?.(data.criterionId!, data.metric!.id, 'weight', newWeight)}
                />
              ) : (
                <span className="text-sm tabular-nums">{data.metric.weight}</span>
              )}
            </div>
          );
        }
        return null;
      },
      size: 160,
      enableHiding: false,
    },
    ...llmTools.map((tool): ColumnDef<TableRow> => ({
      id: tool.id,
      header: () => (
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
          <span className="inline-flex h-6 w-6 absolute -top-1 -right-1 opacity-0 group-hover/header:opacity-100">
            <AdminOnlyButton
              allowed={canEditTools}
              tooltip="Admin role required to edit LLM tools."
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEditLlmTool(tool)}
            >
              <Edit className="h-3 w-3" />
            </AdminOnlyButton>
          </span>
        </div>
      ),
      cell: ({ row }) => {
        const data = row.original;
        if (data.type === 'criterion' && data.criterion) {
          const criterionScore = getAggregatedScore(data.criterion.id, tool.id);
          return (
            <div className="text-center tabular-nums">
              {criterionScore === null ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                <Badge variant="default" className="text-base">
                  {criterionScore.toFixed(2)}%
                </Badge>
              )}
            </div>
          );
        } else if (data.type === 'metric' && data.metric) {
          const measurement = selectLatestMeasurement(measurements, tool.id, data.metric!.id);
          const isPercent = data.metric.unit === 'Percent';
          return (
            <div className="relative flex items-center justify-center group/cell">
              <div className="flex items-center justify-center">
                {measurement ? (
                  <Badge variant="secondary" className="text-base">
                    {measurement.value}{isPercent ? '%' : ''}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    onAddMeasurement(tool.id, data.metric!.id, data.metric!.name, tool.toolName, measurement);
                  }}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        }
        return null;
      },
      size: 200,
      meta: {
        toolName: tool.toolName,
        modelVersion: tool.modelVersion,
      },
    })),
  ], [llmTools, expanded, scores, measurements, onAddMeasurement, onEditLlmTool, canEditTools, criteria, onEditCriterion, onAddMetric, onEditMetric, onUpdateCriterion, onUpdateMetric, getAggregatedScore]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      columnOrder,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  // Filter visible rows based on expanded state
  const visibleRows = table.getRowModel().rows.filter(row => {
    const data = row.original;
    if (data.type === 'metric' && data.criterionId) {
      return expanded[data.criterionId];
    }
    return true;
  });

  // Handle column drag and drop
  const handleColumnDragStart = (columnId: string) => {
    setDraggedColumn(columnId);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = (targetColumnId: string) => {
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      return;
    }

    const currentOrder = table.getState().columnOrder;
    const allColumnIds = table.getAllLeafColumns().map(c => c.id);
    const orderToUse = currentOrder.length > 0 ? currentOrder : allColumnIds;

    const draggedIndex = orderToUse.indexOf(draggedColumn);
    const targetIndex = orderToUse.indexOf(targetColumnId);

    const newOrder = [...orderToUse];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);

    setColumnOrder(newOrder);
    setDraggedColumn(null);
  };

  // Handle row drag and drop (for both criteria and metrics)
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');

  const handleRowDragStart = (rowId: string) => {
    setDraggedRow(rowId);
  };

  const handleRowDragOver = (e: React.DragEvent, rowId: string, element: HTMLElement) => {
    e.preventDefault();
    setDragOverRow(rowId);

    const rect = element.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropPosition(e.clientY < midpoint ? 'before' : 'after');
  };

  const handleRowDragLeave = () => {
    setDragOverRow(null);
  };

  const handleRowDrop = (targetRowId: string, targetType: 'criterion' | 'metric', targetCriterionId?: string) => {
    if (!draggedRow || draggedRow === targetRowId) {
      setDraggedRow(null);
      setDragOverRow(null);
      return;
    }

    const draggedIsCriterion = criteria.some(c => c.id === draggedRow);
    const targetIsCriterion = targetType === 'criterion';

    if (draggedIsCriterion && targetIsCriterion) {
      const currentOrder = criteriaOrder.length > 0 ? criteriaOrder : criteria.map(c => c.id);
      const draggedIndex = currentOrder.indexOf(draggedRow);
      const targetIndex = currentOrder.indexOf(targetRowId);

      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        const newOrder = [...currentOrder];
        const [removed] = newOrder.splice(draggedIndex, 1);

        let insertIndex;

        if (draggedIndex < targetIndex) {
          insertIndex = dropPosition === 'before' ? targetIndex - 1 : targetIndex;
        } else {
          insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
        }

        newOrder.splice(insertIndex, 0, removed);
        setCriteriaOrder(newOrder);
      }
    }
    else if (!draggedIsCriterion && !targetIsCriterion && targetCriterionId) {
      const findMetricIdFromRowId = (rowId: string, criterionId: string) => {
        const criterion = criteria.find(c => c.id === criterionId);
        if (!criterion) return null;

        const prefix = `${criterionId}-`;
        if (rowId.startsWith(prefix)) {
          return rowId.substring(prefix.length);
        }
        return null;
      };

      const draggedCriterionId = tableData.find(r => r.id === draggedRow)?.criterionId;
      const draggedMetricId = findMetricIdFromRowId(draggedRow, draggedCriterionId || '');
      const targetMetricId = findMetricIdFromRowId(targetRowId, targetCriterionId);

      if (draggedCriterionId === targetCriterionId && draggedMetricId && targetMetricId) {
        const criterion = criteria.find(c => c.id === targetCriterionId);
        if (criterion) {
          const currentOrder = metricOrders[targetCriterionId] || criterion.metrics.map(m => m.id);
          const draggedIndex = currentOrder.indexOf(draggedMetricId);
          const targetIndex = currentOrder.indexOf(targetMetricId);

          if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            const newOrder = [...currentOrder];
            const [removed] = newOrder.splice(draggedIndex, 1);

            let insertIndex;

            if (draggedIndex < targetIndex) {
              insertIndex = dropPosition === 'before' ? targetIndex - 1 : targetIndex;
            } else {
              insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
            }

            newOrder.splice(insertIndex, 0, removed);

            setMetricOrders(prev => ({
              ...prev,
              [targetCriterionId]: newOrder
            }));
          }
        }
      }
    }

    setDraggedRow(null);
    setDragOverRow(null);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Evaluation Results</CardTitle>
            <CardDescription>
              Comparison of Large Language Models across various evaluation criteria.
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <Settings2 className="mr-2 h-4 w-4" />
                Customize
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const meta = column.columnDef.meta as any;
                  const label = meta?.toolName
                    ? `${meta.toolName} (${meta.modelVersion})`
                    : column.id;

                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                {table.getHeaderGroups().map((headerGroup) => (
                  <React.Fragment key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canDrag = header.column.id !== 'criterion-metric' && header.column.id !== 'weight';
                      const isBeingDragged = draggedColumn === header.column.id;
                      return (
                        <TableHead
                          key={header.id}
                          className={`font-semibold text-base py-6 relative group/drag ${isBeingDragged ? 'opacity-50 bg-primary/10' : ''}`}
                          style={{ minWidth: header.column.columnDef.size }}
                          draggable={canDrag}
                          onDragStart={() => canDrag && handleColumnDragStart(header.column.id)}
                          onDragOver={handleColumnDragOver}
                          onDrop={() => canDrag && handleColumnDrop(header.column.id)}
                        >
                          <div className="flex items-center justify-center gap-2">
                            {canDrag && (
                              <GripVertical className="h-8 w-8 text-muted-foreground opacity-0 group-hover/drag:opacity-100 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                            )}
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const data = row.original;
                const isCriterion = data.type === 'criterion';
                const isMetric = data.type === 'metric';
                const rowId = isCriterion ? data.criterion?.id : row.id;
                const criterionId = isCriterion ? data.criterion?.id : data.criterionId;
                const isDragging = draggedRow === rowId;
                const isDragOver = dragOverRow === rowId;

                return (
                  <TableRow
                    key={row.id}
                    className={`
                      ${isCriterion ? 'bg-muted/20 hover:bg-muted/40 font-semibold' : 'hover:bg-muted/10'}
                      ${isDragging ? 'opacity-50' : ''}
                      ${isDragOver && dropPosition === 'before' ? 'border-t-2 border-t-primary' : ''}
                      ${isDragOver && dropPosition === 'after' ? 'border-b-2 border-b-primary' : ''}
                      ${isCriterion || isMetric ? 'cursor-move' : ''}
                    `}
                    draggable={isCriterion || isMetric}
                    onDragStart={() => rowId && handleRowDragStart(rowId)}
                    onDragOver={(e) => {
                      if (rowId) {
                        const element = e.currentTarget as HTMLElement;
                        handleRowDragOver(e, rowId, element);
                      }
                    }}
                    onDragLeave={handleRowDragLeave}
                    onDrop={() => rowId && criterionId && handleRowDrop(rowId, data.type, criterionId)}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => {
                      const isColumnBeingDragged = draggedColumn === cell.column.id;
                      return (
                      <TableCell
                        key={cell.id}
                        className={`
                          ${cell.column.id === 'criterion-metric' ? '' : 'align-middle'}
                          ${isColumnBeingDragged ? 'opacity-50 bg-primary/10' : ''}
                        `}
                      >
                        {cellIndex === 0 ? (
                          <div className={`flex items-center gap-2 ${isMetric ? 'pl-6' : ''}`}>
                            {(isCriterion || isMetric) && (
                              <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              {/* Drop zone for moving criteria to the bottom */}
              {draggedRow && criteria.some(c => c.id === draggedRow) && (
                <TableRow
                  className={`h-8 ${dragOverRow === 'drop-zone-bottom' ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/5'}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverRow('drop-zone-bottom');
                    setDropPosition('after');
                  }}
                  onDragLeave={handleRowDragLeave}
                  onDrop={() => {
                    if (draggedRow && criteria.some(c => c.id === draggedRow)) {
                      const currentOrder = criteriaOrder.length > 0 ? criteriaOrder : criteria.map(c => c.id);
                      const lastCriterionId = currentOrder.at(-1);
                      if (lastCriterionId) {
                        handleRowDrop(lastCriterionId, 'criterion', lastCriterionId);
                      }
                    }
                  }}
                >
                  <TableCell colSpan={table.getAllColumns().length} className="text-center text-xs text-muted-foreground">
                    {dragOverRow === 'drop-zone-bottom' ? 'Drop here to move to bottom' : ''}
                  </TableCell>
                </TableRow>
              )}
              {/* Add Criterion button row */}
              {canEditTools && onAddCriterion && (
                <TableRow className="hover:bg-muted/10">
                  <TableCell colSpan={table.getAllColumns().length} className="text-center py-3">
                    <AdminOnlyButton
                      allowed={canEditTools}
                      tooltip="Admin role required to add criteria."
                      variant="ghost"
                      size="sm"
                      onClick={onAddCriterion}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Criterion
                    </AdminOnlyButton>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50 font-bold text-base">
                <TableCell colSpan={2}>Overall Score</TableCell>
                {table.getHeaderGroups()[0].headers.slice(2).map((header) => {
                  if (!header.column.getIsVisible()) return null;

                  const tool = llmTools.find(t => t.id === header.column.id);
                  if (!tool) return null;

                  const overallScore = calculateOverallScore(tool.id);
                  const isColumnBeingDragged = draggedColumn === header.column.id;

                  return (
                    <TableCell
                      key={header.id}
                      className={`text-center align-middle ${isColumnBeingDragged ? 'opacity-50 bg-primary/10' : ''}`}
                    >
                      {overallScore === 'N/A' ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <Badge variant="default" className="text-base">
                          {overallScore}%
                        </Badge>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

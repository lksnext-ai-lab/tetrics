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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, ChevronDown, ChevronRight, Weight, ArrowRightLeft, Settings2, GripVertical } from 'lucide-react';
import React, { useState, useMemo } from 'react';
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
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type VisibilityState,
} from '@tanstack/react-table';
// (Consolidated import above)

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
}

// Flatten structure for table rows
type TableRow = {
  id: string;
  type: 'criterion' | 'metric';
  criterion?: EvaluationCriterion;
  metric?: EvaluationCriterion['metrics'][0];
  criterionId?: string;
};

export function EvalTableEnhanced({ criteria, llmTools, scores, measurements, onScoreUpdate, onAddMeasurement, onEditLlmTool, scopedToSingleGoal = false, canEditTools = true }: Readonly<EvalTableProps>) {
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
  const getAggregatedScore = (criterionId: string, toolConfigId: string): number | null => {
    const score = scores.find(s => s.criterionID === criterionId && s.toolConfigID === toolConfigId);
    if (score && score.score !== 'N/A') {
      return typeof score.score === 'number' ? score.score : null;
    }
    // Fallback: compute client-side if missing from backend
    const criterion = criteria.find(c => c.id === criterionId);
    if (!criterion) return null;
    const relevantMeasurements = measurements.filter(m => m.llmToolConfigurationId === toolConfigId && criterion.metrics.some(mt => mt.id === m.metricId));
    if (relevantMeasurements.length === 0) return null;
    // Map measurement by metricId for quick lookup
    const measurementMap = new Map<string, typeof relevantMeasurements[0]>();
    for (const m of relevantMeasurements) measurementMap.set(m.metricId, m);
    let weightedSum = 0;
    let weightTotal = 0;
    for (const metric of criterion.metrics) {
      const m = measurementMap.get(metric.id);
      if (!m) continue;
      // Use normalized_value from backend if the metric uses normalization; otherwise raw value
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
      return weightedSum; // No criterion weight
    }
    // weighted_sum_normalized: includes criterion weight
    return weightedSum * criterion.weight;
  };

  // Calculate overall aggregated score across all criteria
  const calculateOverallScore = (toolConfigID: string): string => {
    const tool = llmTools.find(t => t.id === toolConfigID);
    // Global view: use backend totalScore if present
    if (!scopedToSingleGoal && tool?.totalScore !== null && tool?.totalScore !== undefined) {
      return tool.totalScore.toFixed(2);
    }
    // Scoped view: sum of aggregated criterion scores (already weighted per server logic)
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
  };

  // Flatten data structure for react-table
  const tableData = useMemo(() => {
    const rows: TableRow[] = [];
    
    // Use custom order if set, otherwise use original criteria order
    const orderedCriteria = criteriaOrder.length > 0
      ? criteriaOrder.map(id => criteria.find(c => c.id === id)).filter(Boolean) as EvaluationCriterion[]
      : criteria;
    
    for (const criterion of orderedCriteria) {
      rows.push({
        id: criterion.id,
        type: 'criterion',
        criterion,
      });
      
      // Use custom metric order if set, otherwise use original metric order
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
            <div
              className="flex items-center gap-2 cursor-pointer font-semibold"
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
              <span>{data.criterion.dimension}</span>
            </div>
          );
        } else if (data.type === 'metric' && data.metric) {
          return (
            <span className="font-medium">{data.metric.name}</span>
          );
        }
        return null;
      },
      size: 300,
      enableHiding: false,
    },
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => {
        const data = row.original;
        if (data.type === 'criterion' && data.criterion) {
          return (
            <div className='flex gap-4 items-center text-sm text-muted-foreground'>
              <div className='flex items-center gap-1'><Weight className='w-4 h-4' /> {data.criterion.weight}</div>
              <div className='flex items-center gap-1'><ArrowRightLeft className='w-4 h-4' /> {data.criterion.aggregationStrategy}</div>
            </div>
          );
        } else if (data.type === 'metric' && data.metric) {
          return <span className="text-sm text-muted-foreground">{data.metric.definition}</span>;
        }
        return null;
      },
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
            <div className="text-center tabular-nums group/cell relative">
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
                onClick={() => {
                  onAddMeasurement(tool.id, data.metric!.id, data.metric!.name, tool.toolName, measurement);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
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
  ], [llmTools, expanded, scores, measurements, onAddMeasurement, onEditLlmTool, canEditTools]);

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
    
    // Determine if we should insert before or after based on cursor position
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

    // Determine if dragged item is a criterion or metric
    const draggedIsCriterion = criteria.some(c => c.id === draggedRow);
    const targetIsCriterion = targetType === 'criterion';

    // Case 1: Both are criteria - reorder criteria
    if (draggedIsCriterion && targetIsCriterion) {
      const currentOrder = criteriaOrder.length > 0 ? criteriaOrder : criteria.map(c => c.id);
      const draggedIndex = currentOrder.indexOf(draggedRow);
      const targetIndex = currentOrder.indexOf(targetRowId);

      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        const newOrder = [...currentOrder];
        // Remove the dragged item from its current position
        const [removed] = newOrder.splice(draggedIndex, 1);
        
        // Calculate insert position
        // After removing, indices shift. We need to account for:
        // 1. Whether we're moving up (draggedIndex > targetIndex) or down (draggedIndex < targetIndex)
        // 2. Whether we're dropping before or after the target
        let insertIndex;
        
        if (draggedIndex < targetIndex) {
          // Moving down: removal shifts all subsequent indices left by 1
          insertIndex = dropPosition === 'before' ? targetIndex - 1 : targetIndex;
        } else {
          // Moving up: removal doesn't affect target index
          insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
        }
        
        newOrder.splice(insertIndex, 0, removed);
        setCriteriaOrder(newOrder);
      }
    }
    // Case 2: Both are metrics within the same criterion - reorder metrics
    else if (!draggedIsCriterion && !targetIsCriterion && targetCriterionId) {
      // Find the metric IDs by parsing the composite row IDs
      // Row ID format is: `${criterionId}-${metricId}`
      // We need to find the metric by looking at the data
      const findMetricIdFromRowId = (rowId: string, criterionId: string) => {
        const criterion = criteria.find(c => c.id === criterionId);
        if (!criterion) return null;
        
        // The rowId format is `criterionId-metricId`, so we remove the criterionId prefix
        const prefix = `${criterionId}-`;
        if (rowId.startsWith(prefix)) {
          return rowId.substring(prefix.length);
        }
        return null;
      };
      
      const draggedCriterionId = tableData.find(r => r.id === draggedRow)?.criterionId;
      const draggedMetricId = findMetricIdFromRowId(draggedRow, draggedCriterionId || '');
      const targetMetricId = findMetricIdFromRowId(targetRowId, targetCriterionId);
      
      // Only allow reordering within the same criterion
      if (draggedCriterionId === targetCriterionId && draggedMetricId && targetMetricId) {
        const criterion = criteria.find(c => c.id === targetCriterionId);
        if (criterion) {
          const currentOrder = metricOrders[targetCriterionId] || criterion.metrics.map(m => m.id);
          const draggedIndex = currentOrder.indexOf(draggedMetricId);
          const targetIndex = currentOrder.indexOf(targetMetricId);

          if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            const newOrder = [...currentOrder];
            // Remove the dragged item from its current position
            const [removed] = newOrder.splice(draggedIndex, 1);
            
            // Calculate insert position
            // After removing, indices shift. We need to account for:
            // 1. Whether we're moving up (draggedIndex > targetIndex) or down (draggedIndex < targetIndex)
            // 2. Whether we're dropping before or after the target
            let insertIndex;
            
            if (draggedIndex < targetIndex) {
              // Moving down: removal shifts all subsequent indices left by 1
              insertIndex = dropPosition === 'before' ? targetIndex - 1 : targetIndex;
            } else {
              // Moving up: removal doesn't affect target index
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
                      const canDrag = header.column.id !== 'criterion-metric' && header.column.id !== 'details';
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
                      // Get the last criterion in current order
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

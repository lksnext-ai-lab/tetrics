# Tetrics CLI Reference

> Auto-generated from `cli.py` — all endpoints with their arguments, flags, and example responses.

**Global flags** (can appear anywhere before the subcommand):

| Flag | Short | Description |
|------|-------|-------------|
| `--server <url>` | `-s` | API base URL (default: `http://localhost:8000/api/v1`) |
| `--token <jwt>` | `-t` | Explicit JWT access token |
| `--json` | `-j` | Output raw JSON instead of Rich tables |
| `--verbose` | `-v` | Show **all** fields in JSON list output (by default only id + key identifiers are returned) |

All commands require authentication. If no token is supplied via `--token` or `TETRICS_TOKEN`, the CLI auto-fetches one via Keycloak password grant using `TETRICS_ADMIN_USER` / `TETRICS_ADMIN_PASSWORD`.

### List output: summary vs verbose

When using `--json` **without** `--verbose`, all `list` commands (and nested list subcommands like `programs goals`, `criteria metrics`, etc.) return only essential identifying fields — typically the entity `id` plus its name/title and key foreign keys. This keeps responses compact and AI-friendly.

Pass `--json --verbose` (or `-j -v`) to get every field.

Rich table output is unchanged and always shows a curated subset of columns.

---

## 1. Evaluation Programs (`programs`)

### `programs list`

List all evaluation programs (paginated).

```
python cli.py programs list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "organization_context": "ACME Corp",
    "responsible_team": "AI Engineering"
  }
]
```

---

### `programs get <id>`

Get a single evaluation program by UUID.

```
python cli.py programs get 550e8400-e29b-41d4-a716-446655440000
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_context": "ACME Corp",
  "responsible_team": "AI Engineering"
}
```

---

### `programs create`

Create a new evaluation program (admin only).

```
python cli.py programs create \
  --organization-context "ACME Corp" \
  --time-period "2026-06-01T00:00:00" \
  --responsible-team "AI Engineering" \
  --validity-period 180 \
  --reevaluation-triggers '["major tool release", "significant user behavior changes"]'
```

**Required options:** `--organization-context`, `--time-period`, `--responsible-team`

**Optional options:** `--validity-period`, `--reevaluation-triggers` (JSON list)

**Example response** (`--json`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_context": "ACME Corp",
  "time_period": "2026-06-01T00:00:00",
  "responsible_team": "AI Engineering",
  "validity_period": 180,
  "reevaluation_triggers": ["major tool release", "significant user behavior changes"],
  "is_active": true,
  "created_at": "2026-01-15T10:30:00",
  "updated_at": "2026-01-15T10:30:00"
}
```

---

### `programs update <id>`

Update an existing evaluation program (admin only). All options are optional — only provided fields are updated.

```
python cli.py programs update 550e8400-e29b-41d4-a716-446655440000 \
  --responsible-team "ML Platform Team" \
  --validity-period 365
```

**Options:** `--organization-context`, `--time-period`, `--responsible-team`, `--validity-period`, `--reevaluation-triggers`

**Example response** (`--json`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_context": "ACME Corp",
  "time_period": "2026-06-01T00:00:00",
  "responsible_team": "ML Platform Team",
  "validity_period": 365,
  "reevaluation_triggers": ["major tool release", "significant user behavior changes"],
  "is_active": true,
  "created_at": "2026-01-15T10:30:00",
  "updated_at": "2026-06-01T14:00:00"
}
```

---

### `programs delete <id>`

Delete an evaluation program (admin only). Prompts for confirmation unless `--force` is used.

```
python cli.py programs delete 550e8400-e29b-41d4-a716-446655440000 --force
```

**Example response:**

```
Deleted evaluation program 550e8400-e29b-41d4-a716-446655440000
```

---

### `programs goals <program-id>`

List all goals belonging to an evaluation program.

```
python cli.py programs goals 550e8400-e29b-41d4-a716-446655440000
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "purpose": "Measure code generation accuracy"
  }
]
```

---

## 2. Goals (`goals`)

### `goals list`

List all goals (paginated).

```
python cli.py goals list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "purpose": "Measure code generation accuracy"
  }
]
```

---

### `goals get <id>`

Get a single goal by UUID.

```
python cli.py goals get 660e8400-e29b-41d4-a716-446655440001
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "purpose": "Measure code generation accuracy"
}
```

---

### `goals create`

Create a new goal (admin only).

```
python cli.py goals create \
  --purpose "Measure code generation accuracy" \
  --focus "Accuracy" \
  --viewpoint "Developer productivity" \
  --evaluation-program-id 550e8400-e29b-41d4-a716-446655440000 \
  --context "Focusing on Python and TypeScript generation"
```

**Required options:** `--purpose`, `--focus`, `--viewpoint`, `--evaluation-program-id`

**Optional options:** `--context` (Markdown string)

**Example response** (`--json`):

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "purpose": "Measure code generation accuracy",
  "focus": "Accuracy",
  "viewpoint": "Developer productivity",
  "context": "Focusing on Python and TypeScript generation",
  "evaluation_program_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_active": true,
  "created_at": "2026-01-15T10:35:00",
  "updated_at": "2026-01-15T10:35:00"
}
```

---

### `goals update <id>`

Update a goal (admin only). All options optional.

```
python cli.py goals update 660e8400-e29b-41d4-a716-446655440001 \
  --purpose "Measure code generation and refactoring accuracy"
```

**Options:** `--purpose`, `--focus`, `--viewpoint`, `--context`

**Example response** (`--json`):

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "purpose": "Measure code generation and refactoring accuracy",
  "focus": "Accuracy",
  "viewpoint": "Developer productivity",
  "context": "Focusing on Python and TypeScript generation",
  "evaluation_program_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_active": true,
  "created_at": "2026-01-15T10:35:00",
  "updated_at": "2026-01-15T11:00:00"
}
```

---

### `goals delete <id>`

Delete a goal (admin only). Prompts for confirmation unless `--force`.

```
python cli.py goals delete 660e8400-e29b-41d4-a716-446655440001 --force
```

**Example response:**

```
Deleted goal 660e8400-e29b-41d4-a716-446655440001
```

---

### `goals criteria <goal-id>`

List evaluation criteria belonging to a goal.

```
python cli.py goals criteria 660e8400-e29b-41d4-a716-446655440001
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "dimension": "Functional Correctness",
    "weight": 1.5,
    "aggregation_strategy": "weighted_average"
  }
]
```

---

## 3. Evaluation Criteria (`criteria`)

### `criteria list`

List all evaluation criteria (paginated).

```
python cli.py criteria list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "dimension": "Functional Correctness",
    "weight": 1.5,
    "aggregation_strategy": "weighted_average"
  }
]
```

---

### `criteria get <id>`

Get a single evaluation criterion.

```
python cli.py criteria get 770e8400-e29b-41d4-a716-446655440002
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "dimension": "Functional Correctness",
  "weight": 1.5,
  "aggregation_strategy": "weighted_average"
}
```

---

### `criteria create`

Create a new evaluation criterion (admin only).

```
python cli.py criteria create \
  --dimension "Functional Correctness" \
  --description "Whether the generated code compiles and passes tests" \
  --goal-id 660e8400-e29b-41d4-a716-446655440001 \
  --weight 1.5 \
  --aggregation-strategy weighted_average
```

**Required options:** `--dimension`, `--description`, `--goal-id`

**Optional options:** `--weight` (default `1.0`), `--aggregation-strategy` (default `weighted_average`; one of: `weighted_average`, `weighted_sum_normalized`, `direct_metric_weights`, `custom`)

**Example response** (`--json`):

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "dimension": "Functional Correctness",
  "description": "Whether the generated code compiles and passes tests",
  "weight": 1.5,
  "aggregation_strategy": "weighted_average",
  "goal_id": "660e8400-e29b-41d4-a716-446655440001",
  "is_active": true,
  "created_at": "2026-01-15T10:40:00",
  "updated_at": "2026-01-15T10:40:00"
}
```

---

### `criteria update <id>`

Update an evaluation criterion (admin only). All options optional.

```
python cli.py criteria update 770e8400-e29b-41d4-a716-446655440002 \
  --weight 2.0
```

**Options:** `--dimension`, `--description`, `--weight`, `--aggregation-strategy`

**Example response** (`--json`):

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "dimension": "Functional Correctness",
  "description": "Whether the generated code compiles and passes tests",
  "weight": 2.0,
  "aggregation_strategy": "weighted_average",
  "goal_id": "660e8400-e29b-41d4-a716-446655440001",
  "is_active": true,
  "created_at": "2026-01-15T10:40:00",
  "updated_at": "2026-01-15T11:00:00"
}
```

---

### `criteria delete <id>`

Delete an evaluation criterion (admin only).

```
python cli.py criteria delete 770e8400-e29b-41d4-a716-446655440002 --force
```

**Example response:**

```
Deleted evaluation criterion 770e8400-e29b-41d4-a716-446655440002
```

---

### `criteria metrics <criterion-id>`

List metrics belonging to a criterion.

```
python cli.py criteria metrics 770e8400-e29b-41d4-a716-446655440002
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "name": "Compilation Success Rate",
    "unit": "Percent",
    "direction": "higher_is_better"
  }
]
```

---

### `criteria scores <criterion-id>`

List aggregated scores for a criterion.

```
python cli.py criteria scores 770e8400-e29b-41d4-a716-446655440002
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "score": 87.5,
    "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
    "tool_config_id": "990e8400-e29b-41d4-a716-446655440004"
  }
]
```

---

### `criteria recalculate <criterion-id>`

Recalculate all aggregated scores for a criterion (admin only). Triggers the server-side aggregation engine.

```
python cli.py criteria recalculate 770e8400-e29b-41d4-a716-446655440002
```

**Example response** (`--json`):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
    "tool_config_id": "990e8400-e29b-41d4-a716-446655440004",
    "score": 87.5,
    "component_metrics": {
      "Compilation Success Rate": 92.0,
      "Test Pass Rate": 83.0
    },
    "timestamp": "2026-01-15T12:00:00",
    "is_active": true,
    "created_at": "2026-01-15T12:00:00",
    "updated_at": "2026-01-15T12:00:00"
  }
]
```

---

## 4. Metrics (`metrics`)

### `metrics list`

List all metrics (paginated).

```
python cli.py metrics list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "name": "Compilation Success Rate",
    "unit": "Percent",
    "direction": "higher_is_better"
  }
]
```

---

### `metrics get <id>`

Get a single metric.

```
python cli.py metrics get 880e8400-e29b-41d4-a716-446655440003
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "name": "Compilation Success Rate",
  "unit": "Percent",
  "direction": "higher_is_better"
}
```

---

### `metrics create`

Create a new metric (admin only).

```
python cli.py metrics create \
  --name "Compilation Success Rate" \
  --definition "Percentage of generated code snippets that compile on first attempt" \
  --unit "Percent" \
  --scale-type "ratio" \
  --collection-method "automated" \
  --direction "higher_is_better" \
  --evaluation-criterion-id 770e8400-e29b-41d4-a716-446655440002 \
  --weight 1.0 \
  --target-value 95.0 \
  --normalization-method "none"
```

**Required options:** `--name`, `--definition`, `--unit` (Percent|Cardinal), `--scale-type` (nominal|ordinal|interval|ratio), `--collection-method` (automated|manual|hybrid), `--direction` (higher_is_better|lower_is_better|target_value), `--evaluation-criterion-id`

**Optional options:** `--weight` (default `1.0`), `--target-value`, `--normalization-method` (none|max|min, default `none`)

**Example response** (`--json`):

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "name": "Compilation Success Rate",
  "definition": "Percentage of generated code snippets that compile on first attempt",
  "unit": "Percent",
  "scale_type": "ratio",
  "collection_method": "automated",
  "normalization_method": "none",
  "weight": 1.0,
  "target_value": 95.0,
  "direction": "higher_is_better",
  "evaluation_criterion_id": "770e8400-e29b-41d4-a716-446655440002",
  "is_active": true,
  "created_at": "2026-01-15T10:45:00",
  "updated_at": "2026-01-15T10:45:00"
}
```

---

### `metrics update <id>`

Update a metric (admin only). All options optional.

```
python cli.py metrics update 880e8400-e29b-41d4-a716-446655440003 \
  --target-value 97.0 \
  --weight 1.5
```

**Options:** `--name`, `--definition`, `--unit`, `--scale-type`, `--collection-method`, `--direction`, `--weight`, `--target-value`, `--normalization-method`

**Example response** (`--json`):

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "name": "Compilation Success Rate",
  "definition": "Percentage of generated code snippets that compile on first attempt",
  "unit": "Percent",
  "scale_type": "ratio",
  "collection_method": "automated",
  "normalization_method": "none",
  "weight": 1.5,
  "target_value": 97.0,
  "direction": "higher_is_better",
  "evaluation_criterion_id": "770e8400-e29b-41d4-a716-446655440002",
  "is_active": true,
  "created_at": "2026-01-15T10:45:00",
  "updated_at": "2026-01-15T11:00:00"
}
```

---

### `metrics delete <id>`

Delete a metric (admin only).

```
python cli.py metrics delete 880e8400-e29b-41d4-a716-446655440003 --force
```

**Example response:**

```
Deleted metric 880e8400-e29b-41d4-a716-446655440003
```

---

## 5. LLM Tool Configurations (`tools`)

### `tools list`

List all LLM tool configurations (paginated).

```
python cli.py tools list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "tool_name": "GitHub Copilot",
    "model_version": "GPT-4o-2024-08-06"
  }
]
```

---

### `tools get <id>`

Get a single LLM tool configuration.

```
python cli.py tools get 990e8400-e29b-41d4-a716-446655440004
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "tool_name": "GitHub Copilot",
  "model_version": "GPT-4o-2024-08-06"
}
```

---

### `tools create`

Create a new LLM tool configuration (admin only).

```
python cli.py tools create \
  --tool-name "GitHub Copilot" \
  --model-version "GPT-4o-2024-08-06" \
  --prompt-strategy "Contextual prompting with system instructions" \
  --parameters '{"temperature": 0.2, "max_tokens": 4096}' \
  --toolchain "Node.js, npm, Jest" \
  --ide "VS Code" \
  --ide-plugins '["GitHub Copilot", "ESLint"]' \
  --timestamp "2026-01-15T11:00:00"
```

**Required options:** `--tool-name`, `--model-version`, `--prompt-strategy`, `--parameters` (JSON object)

**Optional options:** `--timestamp` (ISO datetime, defaults to server time), `--toolchain`, `--ide`, `--ide-plugins` (JSON list), `--conversation-history` (JSON list of `{"role": "...", "content": "..."}` objects), `--skills-used` (JSON list)

**Example response** (`--json`):

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "tool_name": "GitHub Copilot",
  "model_version": "GPT-4o-2024-08-06",
  "prompt_strategy": "Contextual prompting with system instructions",
  "parameters": {
    "temperature": 0.2,
    "max_tokens": 4096
  },
  "toolchain": "Node.js, npm, Jest",
  "ide": "VS Code",
  "ide_plugins": ["GitHub Copilot", "ESLint"],
  "conversation_history": null,
  "skills_used": null,
  "timestamp": "2026-01-15T11:00:00",
  "total_score": null,
  "is_active": true,
  "created_at": "2026-01-15T11:00:00",
  "updated_at": "2026-01-15T11:00:00"
}
```

---

### `tools update <id>`

Update an LLM tool configuration (admin only). All options optional.

```
python cli.py tools update 990e8400-e29b-41d4-a716-446655440004 \
  --model-version "GPT-4o-2024-11-20" \
  --parameters '{"temperature": 0.1, "max_tokens": 8192}'
```

**Options:** `--tool-name`, `--model-version`, `--prompt-strategy`, `--parameters`, `--timestamp`, `--toolchain`, `--ide`, `--ide-plugins`, `--conversation-history`, `--skills-used`

**Example response** (`--json`):

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "tool_name": "GitHub Copilot",
  "model_version": "GPT-4o-2024-11-20",
  "prompt_strategy": "Contextual prompting with system instructions",
  "parameters": {
    "temperature": 0.1,
    "max_tokens": 8192
  },
  "toolchain": "Node.js, npm, Jest",
  "ide": "VS Code",
  "ide_plugins": ["GitHub Copilot", "ESLint"],
  "conversation_history": null,
  "skills_used": null,
  "timestamp": "2026-01-15T11:00:00",
  "total_score": 85.0,
  "is_active": true,
  "created_at": "2026-01-15T11:00:00",
  "updated_at": "2026-01-15T11:30:00"
}
```

---

### `tools delete <id>`

Delete an LLM tool configuration (admin only).

```
python cli.py tools delete 990e8400-e29b-41d4-a716-446655440004 --force
```

**Example response:**

```
Deleted tool config 990e8400-e29b-41d4-a716-446655440004
```

---

### `tools measurements <config-id>`

List measurements for a tool configuration.

```
python cli.py tools measurements 990e8400-e29b-41d4-a716-446655440004
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "value": 92.0,
    "metric_id": "880e8400-e29b-41d4-a716-446655440003",
    "llm_tool_configuration_id": "990e8400-e29b-41d4-a716-446655440004"
  }
]
```

---

### `tools scores <config-id>`

List aggregated scores for a tool configuration.

```
python cli.py tools scores 990e8400-e29b-41d4-a716-446655440004
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "score": 87.5,
    "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
    "tool_config_id": "990e8400-e29b-41d4-a716-446655440004"
  }
]
```

---

## 6. Measurements (`measurements`)

### `measurements list`

List all measurements (paginated).

```
python cli.py measurements list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "value": 92.0,
    "metric_id": "880e8400-e29b-41d4-a716-446655440003",
    "llm_tool_configuration_id": "990e8400-e29b-41d4-a716-446655440004"
  }
]
```

---

### `measurements get <id>`

Get a single measurement.

```
python cli.py measurements get bb0e8400-e29b-41d4-a716-446655440006
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "value": 92.0,
  "metric_id": "880e8400-e29b-41d4-a716-446655440003",
  "llm_tool_configuration_id": "990e8400-e29b-41d4-a716-446655440004"
}
```

---

### `measurements create`

Create a new measurement. This is the only endpoint available to **any authenticated user** (not just admins).

```
python cli.py measurements create \
  --value 92.0 \
  --metric-id 880e8400-e29b-41d4-a716-446655440003 \
  --llm-tool-configuration-id 990e8400-e29b-41d4-a716-446655440004 \
  --evaluator "automated-ci" \
  --notes "Measured across 100 test cases" \
  --normalized-value 0.92
```

**Required options:** `--value`, `--metric-id`, `--llm-tool-configuration-id`

**Optional options:** `--evaluator`, `--notes`, `--normalized-value`

**Example response** (`--json`):

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "value": 92.0,
  "normalized_value": 0.92,
  "evaluator": "automated-ci",
  "notes": "Measured across 100 test cases",
  "llm_tool_configuration_id": "990e8400-e29b-41d4-a716-446655440004",
  "metric_id": "880e8400-e29b-41d4-a716-446655440003",
  "date": "2026-01-15T12:00:00",
  "is_active": true,
  "created_at": "2026-01-15T12:00:00",
  "updated_at": "2026-01-15T12:00:00"
}
```

---

### `measurements update <id>`

Update a measurement (admin only). All options optional.

```
python cli.py measurements update bb0e8400-e29b-41d4-a716-446655440006 \
  --value 94.0 \
  --notes "Re-evaluated with larger sample"
```

**Options:** `--value`, `--evaluator`, `--notes`, `--normalized-value`

**Example response** (`--json`):

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "value": 94.0,
  "normalized_value": 0.94,
  "evaluator": "automated-ci",
  "notes": "Re-evaluated with larger sample",
  "llm_tool_configuration_id": "990e8400-e29b-41d4-a716-446655440004",
  "metric_id": "880e8400-e29b-41d4-a716-446655440003",
  "date": "2026-01-15T12:00:00",
  "is_active": true,
  "created_at": "2026-01-15T12:00:00",
  "updated_at": "2026-01-15T13:00:00"
}
```

---

### `measurements delete <id>`

Delete a measurement (admin only).

```
python cli.py measurements delete bb0e8400-e29b-41d4-a716-446655440006 --force
```

**Example response:**

```
Deleted measurement bb0e8400-e29b-41d4-a716-446655440006
```

---

## 7. Aggregated Scores (`scores`)

### `scores list`

List all aggregated scores (paginated).

```
python cli.py scores list [--skip 0] [--limit 100]
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "score": 87.5,
    "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
    "tool_config_id": "990e8400-e29b-41d4-a716-446655440004"
  }
]
```

---

### `scores get <id>`

Get a single aggregated score.

```
python cli.py scores get aa0e8400-e29b-41d4-a716-446655440005
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "score": 87.5,
  "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
  "tool_config_id": "990e8400-e29b-41d4-a716-446655440004"
}
```

---

### `scores create`

Create a new aggregated score (admin only).

```
python cli.py scores create \
  --score 87.5 \
  --criterion-id 770e8400-e29b-41d4-a716-446655440002 \
  --tool-config-id 990e8400-e29b-41d4-a716-446655440004 \
  --component-metrics '{"Compilation Success Rate": 92.0, "Test Pass Rate": 83.0}'
```

**Required options:** `--score`, `--criterion-id`, `--tool-config-id`, `--component-metrics` (JSON object)

**Example response** (`--json`):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
  "tool_config_id": "990e8400-e29b-41d4-a716-446655440004",
  "score": 87.5,
  "component_metrics": {
    "Compilation Success Rate": 92.0,
    "Test Pass Rate": 83.0
  },
  "timestamp": "2026-01-15T12:00:00",
  "is_active": true,
  "created_at": "2026-01-15T12:00:00",
  "updated_at": "2026-01-15T12:00:00"
}
```

---

### `scores update <id>`

Update an aggregated score (admin only). All options optional.

```
python cli.py scores update aa0e8400-e29b-41d4-a716-446655440005 \
  --score 89.0
```

**Options:** `--score`, `--component-metrics`

**Example response** (`--json`):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "criterion_id": "770e8400-e29b-41d4-a716-446655440002",
  "tool_config_id": "990e8400-e29b-41d4-a716-446655440004",
  "score": 89.0,
  "component_metrics": {
    "Compilation Success Rate": 92.0,
    "Test Pass Rate": 83.0
  },
  "timestamp": "2026-01-15T12:00:00",
  "is_active": true,
  "created_at": "2026-01-15T12:00:00",
  "updated_at": "2026-01-15T13:00:00"
}
```

---

### `scores delete <id>`

Delete an aggregated score (admin only).

```
python cli.py scores delete aa0e8400-e29b-41d4-a716-446655440005 --force
```

**Example response:**

```
Deleted aggregated score aa0e8400-e29b-41d4-a716-446655440005
```

---

## 8. Users (`users`)

### `users get <user-id>`

Get a user by internal UUID.

```
python cli.py users get 1a2b3c4d-5e6f-7890-abcd-ef1234567890
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "full_name": "Jane Doe"
}
```

---

### `users get-by-email <email>`

Get a user by email address.

```
python cli.py users get-by-email user@example.com
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "full_name": "Jane Doe"
}
```

---

### `users get-by-external-id <external-id>`

Get a user by external identity provider ID.

```
python cli.py users get-by-external-id keycloak-uuid-abc123
```

**Example response** (`--json`, default compact; add `--verbose` for all fields):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "full_name": "Jane Doe"
}
```

---

### `users sync`

Sync a user from the identity provider (creates or updates).

```
python cli.py users sync \
  --external-id "keycloak-uuid-abc123" \
  --email "user@example.com" \
  --full-name "Jane Doe"
```

**Required options:** `--external-id`, `--email`

**Optional options:** `--full-name`

**Example response** (`--json`):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "external_id": "keycloak-uuid-abc123",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "bio": null,
  "notification_preferences": null,
  "theme_preference": null,
  "is_active": true
}
```

---

### `users update-preferences <user-id>`

Update user preferences. All options optional.

```
python cli.py users update-preferences 1a2b3c4d-5e6f-7890-abcd-ef1234567890 \
  --bio "AI researcher specializing in LLM evaluation" \
  --notification-preferences '{"email": true, "in_app": false}' \
  --theme-preference "dark"
```

**Options:** `--bio`, `--notification-preferences` (JSON string), `--theme-preference` (light|dark|system)

**Example response** (`--json`):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "external_id": "keycloak-uuid-abc123",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "bio": "AI researcher specializing in LLM evaluation",
  "notification_preferences": "{\"email\": true, \"in_app\": false}",
  "theme_preference": "dark",
  "is_active": true
}
```

---

### `users deactivate <user-id>`

Deactivate a user (admin only). Prompts for confirmation unless `--force`.

```
python cli.py users deactivate 1a2b3c4d-5e6f-7890-abcd-ef1234567890 --force
```

**Example response** (`--json`):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "external_id": "keycloak-uuid-abc123",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "bio": "AI researcher specializing in LLM evaluation",
  "notification_preferences": "{\"email\": true, \"in_app\": false}",
  "theme_preference": "dark",
  "is_active": false
}
```

---

### `users reactivate <user-id>`

Reactivate a previously deactivated user (admin only).

```
python cli.py users reactivate 1a2b3c4d-5e6f-7890-abcd-ef1234567890
```

**Example response** (`--json`):

```json
{
  "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "external_id": "keycloak-uuid-abc123",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "bio": "AI researcher specializing in LLM evaluation",
  "notification_preferences": "{\"email\": true, \"in_app\": false}",
  "theme_preference": "dark",
  "is_active": true
}
```

---

## Summary Table

| Group | Command | HTTP Method | Endpoint | Auth Required |
|-------|---------|-------------|----------|---------------|
| **programs** | `list` | GET | `/domain/evaluation-programs` | Any |
| | `get` | GET | `/domain/evaluation-programs/{id}` | Any |
| | `create` | POST | `/domain/evaluation-programs` | Admin |
| | `update` | PUT | `/domain/evaluation-programs/{id}` | Admin |
| | `delete` | DELETE | `/domain/evaluation-programs/{id}` | Admin |
| | `goals` | GET | `/domain/evaluation-programs/{id}/goals` | Any |
| **goals** | `list` | GET | `/domain/goals` | Any |
| | `get` | GET | `/domain/goals/{id}` | Any |
| | `create` | POST | `/domain/goals` | Admin |
| | `update` | PUT | `/domain/goals/{id}` | Admin |
| | `delete` | DELETE | `/domain/goals/{id}` | Admin |
| | `criteria` | GET | `/domain/goals/{id}/evaluation-criteria` | Any |
| **criteria** | `list` | GET | `/domain/evaluation-criteria` | Any |
| | `get` | GET | `/domain/evaluation-criteria/{id}` | Any |
| | `create` | POST | `/domain/evaluation-criteria` | Admin |
| | `update` | PUT | `/domain/evaluation-criteria/{id}` | Admin |
| | `delete` | DELETE | `/domain/evaluation-criteria/{id}` | Admin |
| | `metrics` | GET | `/domain/evaluation-criteria/{id}/metrics` | Any |
| | `scores` | GET | `/domain/evaluation-criteria/{id}/aggregated-scores` | Any |
| | `recalculate` | POST | `/domain/evaluation-criteria/{id}/recalculate-scores` | Admin |
| **metrics** | `list` | GET | `/domain/metrics` | Any |
| | `get` | GET | `/domain/metrics/{id}` | Any |
| | `create` | POST | `/domain/metrics` | Admin |
| | `update` | PUT | `/domain/metrics/{id}` | Admin |
| | `delete` | DELETE | `/domain/metrics/{id}` | Admin |
| **tools** | `list` | GET | `/domain/llm-tool-configurations` | Any |
| | `get` | GET | `/domain/llm-tool-configurations/{id}` | Any |
| | `create` | POST | `/domain/llm-tool-configurations` | Admin |
| | `update` | PUT | `/domain/llm-tool-configurations/{id}` | Admin |
| | `delete` | DELETE | `/domain/llm-tool-configurations/{id}` | Admin |
| | `measurements` | GET | `/domain/llm-tool-configurations/{id}/measurements` | Any |
| | `scores` | GET | `/domain/llm-tool-configurations/{id}/aggregated-scores` | Any |
| **measurements** | `list` | GET | `/domain/measurements` | Any |
| | `get` | GET | `/domain/measurements/{id}` | Any |
| | `create` | POST | `/domain/measurements` | Any |
| | `update` | PUT | `/domain/measurements/{id}` | Admin |
| | `delete` | DELETE | `/domain/measurements/{id}` | Admin |
| **scores** | `list` | GET | `/domain/aggregated-scores` | Any |
| | `get` | GET | `/domain/aggregated-scores/{id}` | Any |
| | `create` | POST | `/domain/aggregated-scores` | Admin |
| | `update` | PUT | `/domain/aggregated-scores/{id}` | Admin |
| | `delete` | DELETE | `/domain/aggregated-scores/{id}` | Admin |
| **users** | `get` | GET | `/users/{id}` | Any |
| | `get-by-email` | GET | `/users/email/{email}` | Any |
| | `get-by-external-id` | GET | `/users/external/{external_id}` | Any |
| | `sync` | POST | `/users/sync` | Any |
| | `update-preferences` | PUT | `/users/{id}/preferences` | Any |
| | `deactivate` | PATCH | `/users/{id}/deactivate` | Admin |
| | `reactivate` | PATCH | `/users/{id}/reactivate` | Admin |

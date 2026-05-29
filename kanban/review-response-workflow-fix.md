---
uuid: "inbox-workspaces-openhax-codex-codex-auth-kanban-inbox-workspaces-openhax-codex-codex-auth-spec-review-response-workflow-fix-md"
title: "Review Response Workflow Fix"
status: incoming
priority: P3
labels: ["specs", "migrated-spec"]
created_at: "2026-05-29T04:01:26.132Z"
source: "inbox/workspaces/openhax-codex/codex-auth/spec/review-response-workflow-fix.md"
category: "specs"
---

> Source: `inbox/workspaces/openhax-codex/codex-auth/spec/review-response-workflow-fix.md`
> Migrated-to-kanban: `inbox/workspaces/openhax-codex/codex-auth/kanban/review-response-workflow-fix.md`

# Review Response Workflow Fix

## Context
- `.github/workflows/review-response.yml:91` – GitHub Actions reports a YAML syntax error; lines inside the heredoc body are not indented under the `run: |` block, so the workflow parser treats them as YAML and fails.

## Existing Issues / PRs
- None discovered; manual inspection only.

## Requirements / Definition of Done
- Workflow parses cleanly (no syntax errors) with heredoc content correctly indented.
- Heredoc body remains unchanged aside from indentation; functionality stays identical.
- Workflow file remains compliant with GitHub Actions syntax and repository conventions.

## Plan

### Phase 1 – Confirm Failure Source
1. Inspect `.github/workflows/review-response.yml` around the failing lines to ensure indentation is the root cause (Completed via `read`).

### Phase 2 – Implement Fix
1. Indent the heredoc content lines (Automated follow-up…, etc.) so they remain inside the shell block.
2. Keep surrounding commands untouched to avoid altering workflow behavior.

### Phase 3 – Validate
1. Re-read the updated YAML block to ensure indentation is consistent (12 spaces for script body).
2. Optionally run `actionlint` locally if available (not required but recommended) or rely on visual inspection + YAML structure.
3. Summarize fix and advise user on re-running GitHub workflow.

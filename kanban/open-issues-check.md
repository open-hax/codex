---
uuid: "inbox-workspaces-openhax-codex-codex-auth-kanban-inbox-workspaces-openhax-codex-codex-auth-spec-open-issues-check-md"
title: "Open Issues Check"
status: incoming
priority: P3
labels: ["specs", "migrated-spec"]
created_at: "2026-05-29T04:01:26.131Z"
source: "inbox/workspaces/openhax-codex/codex-auth/spec/open-issues-check.md"
category: "specs"
---

> Source: `inbox/workspaces/openhax-codex/codex-auth/spec/open-issues-check.md`
> Migrated-to-kanban: `inbox/workspaces/openhax-codex/codex-auth/kanban/open-issues-check.md`

# Open Issues Check

## Context
- Repository: open-hax/codex
- Date: 2025-11-14
- Command: `gh issue list`

## Existing Issues / PRs
- Issues discovered via `gh issue list`; no additional related PRs reviewed for this request.

## Code Files & References
- No code files touched; request limited to reporting current GitHub issues.

## Definition of Done
1. Execute `gh issue list` against the repository.
2. Capture identifiers, titles, labels, and timestamps for all open issues.
3. Share the results with the user.

## Requirements
- Provide the user with the current list of open GitHub issues.
- Ensure the data reflects the latest available state at command execution time.

---
uuid: "inbox-workspaces-openhax-codex-codex-auth-kanban-inbox-workspaces-openhax-codex-codex-auth-spec-issue-11-docs-package-md"
title: "Spec: Fix package name in `test/README.md`"
status: incoming
priority: P3
labels: ["specs", "migrated-spec"]
created_at: "2026-05-29T04:01:26.118Z"
source: "inbox/workspaces/openhax-codex/codex-auth/spec/issue-11-docs-package.md"
category: "specs"
---

> Source: `inbox/workspaces/openhax-codex/codex-auth/spec/issue-11-docs-package.md`
> Migrated-to-kanban: `inbox/workspaces/openhax-codex/codex-auth/kanban/issue-11-docs-package.md`

# Spec: Fix package name in `test/README.md`

## Context
- Issue: #11 (Docs: Fix package name in `test/README.md`)
- Repository already references `@openhax/codex` elsewhere, but the test suite description still says "OpenAI Codex OAuth plugin".
- Goal: update the sentence at the top of `test/README.md` so it names the npm package and removes the outdated wording.

## Code Files & References
- `test/README.md` (lines 1-4): change the description from `OpenAI Codex OAuth plugin` to `@openhax/codex, the OpenHax Codex OAuth plugin` to match the npm identity.

## Definition of Done
1. The introductory sentence in `test/README.md` references `@openhax/codex` with the correct branding.
2. No other files are modified.
3. Branch is pushed and PR opened against `staging` to resolve issue #11.

## Requirements
- Preserve the structure and formatting of `test/README.md`.
- Use inline code formatting when referencing `@openhax/codex`.
- Keep the description consistent with the rest of the docs (OpenHax branding).

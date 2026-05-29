---
uuid: "inbox-workspaces-openhax-codex-codex-auth-kanban-inbox-workspaces-openhax-codex-codex-auth-spec-pr-20-review-md"
title: "PR 20 Review Tracking"
status: incoming
priority: P3
labels: ["specs", "migrated-spec"]
created_at: "2026-05-29T04:01:26.126Z"
source: "inbox/workspaces/openhax-codex/codex-auth/spec/pr-20-review.md"
category: "specs"
---

> Source: `inbox/workspaces/openhax-codex/codex-auth/spec/pr-20-review.md`
> Migrated-to-kanban: `inbox/workspaces/openhax-codex/codex-auth/kanban/pr-20-review.md`

# PR 20 Review Tracking

## Code files referenced

- `test/plugin-config.test.ts:45-124` – validate that the two error-handling tests are de-duplicated, single `consoleSpy` call is scoped, and asserts match the extended default config shape (`enableCodexCompaction`, `autoCompactMinMessages`).
- `lib/request/fetch-helpers.ts:136-155` – ensure `applyCompactedHistory` is guarded by `compactionEnabled` and does not run when `pluginConfig.enableCodexCompaction === false`.
- `lib/request/request-transformer.ts:71-83` – keep `computeFallbackHashForBody` resilient to non-serializable metadata by wrapping the stringification in a `try/catch` and falling back to a stable seed (e.g., the normalized model name).
- `lib/request/request-transformer.ts:560-665` – preserve the compaction prompt sanitization heuristics while watching for future false positives (optional follow up).

## Existing issues

- `https://github.com/open-hax/codex/pull/20` (device/stealth) has open review comments from coderabbit.ai about the plugin-config tests, compaction gating, and hashing robustness. The `coderabbit` review thread `PRR_kwDOQJmo4M7O5BH7` is marked as TODO.

## Existing PRs referenced

- `https://github.com/open-hax/codex/pull/20`

## Definition of done

1. All actionable review comments on PR #20 are resolved (tests updated, compaction gating fixed, fallback hashing hardened, or noted as intentional).
2. `npm test` (or equivalent targeted regex) passes locally, proving the test suite is consistent with the new expectations.
3. The spec and summary explain which comments were addressed and why.

## Requirements

- Stick to the Codex CLI roadmap (no new features beyond review fixes).
- Do not revert or discard unrelated branch changes minted earlier in `device/stealth`.
- Maintain lint/format output (current `pnpm lint` steps already run by CI). Keep new tests minimal.

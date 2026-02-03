# Issue 67 - Auto-update triage

## Issue

- #67 Auto-update: check npm latest, clear old install, toast user (open)
- No related PRs found.

## Relevant code and docs

- index.ts:66-137 — plugin entry; startup hook (cache warming, instructions fetch) is likely place to trigger an update check without blocking.
- lib/logger.ts:75-218 — toast and warn logging helpers; `tui.showToast` wrapper and console fallback.
- lib/utils/file-system-utils.ts:15-48 — helpers for `~/.opencode` paths and safe file I/O (useful for locating cached installs/configs).
- docs/index.md:54-62 — current manual update steps (sed + rm in `~/.cache/opencode`).
- README.md:669 — notes that plugins live under `~/.cache/opencode`; Codex assets under `~/.opencode`; advises clearing both for new releases.
- package.json:2-4,31-46 — package name/version (0.4.4) and scripts; no auto-update logic today.

## Requirements from issue

- Detect newer `@openhax/codex` via npm `dist-tags.latest` vs local installed version.
- Trigger at startup/interval with rate limiting/backoff similar to cache protections; avoid registry hammering.
- If newer version: remove existing install/cache first to avoid mixed artifacts; install or prompt install.
- Notify user with toast including version; log fallback when TUI unavailable.
- Offline/registry failures: warn and skip; already on latest: no-op without toast spam.
- Failed update should not break plugin or leave corrupted state (prefer rollback/leave current intact).

## Definition of done (triage)

- Documented scope/risks/assumptions for auto-update flow.
- Identified insertion points and supporting utilities for version detection, cache clearing, notification, and throttling.
- Listed open questions/blockers for implementation.

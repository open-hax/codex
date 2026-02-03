# Config and Env Var Review

Prompt: review all config and env vars used in this system.

## Files to Inspect

- lib/config.ts:12-91 (plugin defaults, CODEX_MODE env override, appendEnvContext)
- lib/logger.ts:8-90 (logging env flags and numeric limits)
- lib/request/request-transformer.ts:25-158 (appendEnvContext fallback to env)
- lib/request/fetch-helpers.ts:120-167 (appendEnvContext override when transforming requests)
- lib/server/dashboard.ts:41-168 (NODE_ENV guard for dashboard server)
- scripts/detect-release-type.mjs:18-31 (RELEASE_BASE_REF, GITHUB_SHA)
- scripts/sync-github-secrets.mjs:5-120 (GITHUB_REPOSITORY inference, required secret env vars)
- scripts/review-response-context.mjs:7-110 (GITHUB_EVENT_PATH, GITHUB_OUTPUT)
- docs/configuration.md (documented config/env behaviour and defaults)

## Existing Issues / PRs

- Not checked for this review.

## Definition of Done

- Inventory every configuration field (plugin config + user config options) and all environment variables referenced in code or docs.
- Provide file/line references for each config/env item.
- Clarify defaults, precedence, and how env vars alter behaviour.
- Summarize findings for the user.

## Requirements

- No code changes needed unless documentation gaps are found.
- Keep notes in this spec if new findings arise during review.

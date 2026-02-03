# Spec: GPT-5.2 support parity

## Context

- The latest Codex CLI already exposes the frontier `gpt-5.2` preset with low/medium/high/**extra high** reasoning (see `openai/codex@main:codex-rs/core/src/openai_models/model_presets.rs:97-123`) and custom prompt scaffolding (`codex-rs/core/src/openai_models/model_family.rs:326-339`).
- This plugin still normalizes unknown GPT-5.\* requests to `gpt-5`/`gpt-5.1` (`lib/request/model-config.ts:3-44`) and only allows `xhigh` on `gpt-5.1-codex-max` (`lib/request/model-config.ts:98-155`, `test/request-transformer.test.ts:23-166`), so Codex CLI users cannot target `gpt-5.2` through OpenCode.
- Documentation claims that `xhigh` is exclusive to Codex Max (`README.md:450-461`, `AGENTS.md:7-160`, `docs/reasoning-effort-levels-update.md:36-56`), which is outdated once `gpt-5.2` is available.

## Existing issues / PRs

- No tracked issue or PR in this repo yet; feature request came directly from user instructions after reviewing upstream Codex CLI releases.

## References

- Normalization & reasoning heuristics: `lib/request/model-config.ts:3-170`
- Request transformation + tests: `lib/request/request-transformer.ts:1-160`, `test/request-transformer.test.ts:1-300`
- Config tests: `test/config.test.ts:100-200`
- Docs mentioning supported models & reasoning tiers: `README.md:21-580`, `AGENTS.md:1-200`, `docs/reasoning-effort-levels-update.md:1-80`, `docs/configuration.md:1-200`
- Upstream behavior: `openai/codex@main:codex-rs/core/src/openai_models/model_presets.rs:97-123`, `codex-rs/core/src/openai_models/model_family.rs:326-339`, `codex-rs/core/gpt_5_2_prompt.md`

## Requirements / Definition of Done

1. `normalizeModel()` recognizes all `gpt-5.2*` variants (including `/model` prefixes and suffix presets) and preserves the canonical slug `gpt-5.2` when targeting that model.
2. `classifyModel()` / `getReasoningConfig()` treat `gpt-5.2` as a frontier family with:
   - default `reasoningEffort` of `medium` (no "none" option),
   - support for `xhigh` without downgrading,
   - clamping of `none`/`minimal` to `low`, matching Codex CLI presets.
3. Requests selecting `gpt-5.2` propagate correct reasoning and verbosity defaults inside `transformRequestBody()` and keep Codex tooling toggles intact.
4. Unit tests cover normalization, reasoning clamps, and transformation results for `gpt-5.2`, plus regression tests ensuring other families keep previous behavior.
5. Documentation (README, AGENTS.md, reasoning docs) updates to mention `gpt-5.2`, its reasoning tiers, and the broader availability of `xhigh` (Codex Max + GPT-5.2).
6. Add release notes / change summary acknowledging the new model, and ensure `npm test` passes.

## Plan

**Phase 1 – Research (complete)**

- Use `gh` to inspect upstream Codex CLI commits/files for `gpt-5.2` presets and reasoning fences.

**Phase 2 – Implementation**

1. Extend `lib/request/model-config.ts` normalization + flagging logic (including `applyRequestedEffort` / `normalizeEffortForModel`) for `gpt-5.2`.
2. Update `transformRequestBody` tests (`test/request-transformer.test.ts`, `test/config.test.ts`) covering new defaults and `xhigh` handling.
3. Refresh docs (`README.md`, `AGENTS.md`, `docs/reasoning-effort-levels-update.md`, other references) to explain `gpt-5.2` and the revised `xhigh` policy.

**Phase 3 – Validation**

- Run `npm test` and capture output; update this spec + final response with results.

## Change Log

- 2025-12-12: Initial spec drafted for GPT-5.2 normalization, reasoning, tests, and documentation updates.
- 2025-12-12: Implemented normalization/reasoning changes, added config + script entries, updated docs, and verified tests for GPT-5.2 support.

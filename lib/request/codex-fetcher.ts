import type { PluginInput } from "@opencode-ai/plugin";
import type { Auth } from "@opencode-ai/sdk";
import { maybeHandleCodexCommand } from "../commands/codex-metrics.js";
import { LOG_STAGES } from "../constants.js";
import { logRequest } from "../logger.js";
import { recordRequestMetrics } from "../metrics/request-metrics.js";
import { recordSessionResponseFromHandledResponse } from "../session/response-recorder.js";
import type { SessionManager } from "../session/session-manager.js";
import type { PluginConfig, UserConfig } from "../types.js";
import {
	createCodexHeaders,
	extractRequestUrl,
	handleErrorResponse,
	handleSuccessResponse,
	refreshAndUpdateToken,
	rewriteUrlForCodex,
	shouldRefreshToken,
	transformRequestForCodex,
} from "./fetch-helpers.js";

export type CodexFetcherDeps = {
	getAuth: () => Promise<Auth>;
	client: PluginInput["client"];
	accountId: string;
	userConfig: UserConfig;
	codexMode: boolean;
	sessionManager: SessionManager;
	codexInstructions: string;
	pluginConfig: PluginConfig;
};

export function createCodexFetcher(deps: CodexFetcherDeps) {
	const {
		getAuth,
		client,
		accountId,
		userConfig,
		codexMode,
		sessionManager,
		codexInstructions,
		pluginConfig,
	} = deps;

	async function ensureValidAuth(): Promise<{ auth: Auth; response?: Response }> {
		const currentAuth = await getAuth();
		if (shouldRefreshToken(currentAuth)) {
			const refreshResult = await refreshAndUpdateToken(currentAuth, client);
			if (!refreshResult.success) {
				return { auth: currentAuth, response: refreshResult.response };
			}
			return { auth: refreshResult.auth };
		}
		return { auth: currentAuth };
	}

	function extractRequestMetrics(requestUrl: string, body: Record<string, unknown>) {
		const promptCacheKey = Boolean(body.prompt_cache_key ?? body.promptCacheKey);
		const tools = Array.isArray(body.tools) ? (body.tools as unknown[]) : [];
		const toolChoiceRaw = body.tool_choice;
		const toolChoice =
			typeof toolChoiceRaw === "string"
				? toolChoiceRaw
				: toolChoiceRaw && typeof toolChoiceRaw === "object" && "type" in toolChoiceRaw
					? (toolChoiceRaw as { type?: unknown }).type
					: undefined;
		const parallelToolCalls =
			typeof body.parallel_tool_calls === "boolean" ? (body.parallel_tool_calls as boolean) : undefined;
		const includeRaw = body.include;
		const include = Array.isArray(includeRaw)
			? (includeRaw as unknown[]).filter((value): value is string => typeof value === "string")
			: undefined;
		const store = typeof body.store === "boolean" ? (body.store as boolean) : undefined;
		const reasoning = body.reasoning as { effort?: unknown; summary?: unknown } | undefined;
		const text = body.text as { verbosity?: unknown } | undefined;
		let safeUrl = String(requestUrl);
		try {
			safeUrl = new URL(requestUrl).toString();
		} catch {
			// keep derived string form
		}

		return {
			url: safeUrl,
			model: typeof body.model === "string" ? (body.model as string) : undefined,
			promptCacheKey,
			toolCount: tools.length,
			toolChoice: typeof toolChoice === "string" ? toolChoice : undefined,
			parallelToolCalls,
			include,
			store,
			reasoningEffort: typeof reasoning?.effort === "string" ? (reasoning.effort as string) : undefined,
			reasoningSummary: typeof reasoning?.summary === "string" ? (reasoning.summary as string) : undefined,
			textVerbosity: typeof text?.verbosity === "string" ? (text.verbosity as string) : undefined,
		};
	}

	return async function codexFetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
		const { auth: currentAuth, response: authErrorResponse } = await ensureValidAuth();
		if (authErrorResponse) {
			return authErrorResponse;
		}

		const originalUrl = extractRequestUrl(input);
		const transformation = await transformRequestForCodex(
			init,
			originalUrl,
			codexInstructions,
			userConfig,
			codexMode,
			sessionManager,
			pluginConfig,
		);

		// Decide final endpoint AFTER we know the normalized model
		const effectiveModel = transformation?.body?.model;
		const url = rewriteUrlForCodex(originalUrl, effectiveModel);

		if (transformation) {
			const commandResponse = maybeHandleCodexCommand(transformation.body, { sessionManager });
			if (commandResponse) {
				return commandResponse;
			}
		}

		const transformedBody = transformation?.body;
		let effectiveBody = transformedBody;
		let effectiveContext = transformation?.sessionContext;

		if (sessionManager && transformedBody) {
			const applyResult = sessionManager.applyRequest(transformedBody, effectiveContext);
			effectiveBody = applyResult.body;
			effectiveContext = applyResult.context ?? effectiveContext;
		}

		if (effectiveBody) {
			const metrics = extractRequestMetrics(url, effectiveBody as Record<string, unknown>);
			recordRequestMetrics(metrics);
		}

		const hasTools = effectiveBody?.tools !== undefined;
		const requestInit: RequestInit = { ...(transformation?.updatedInit ?? init ?? {}) };
		if (effectiveBody) {
			requestInit.body = JSON.stringify(effectiveBody);
		}
		const accessToken = currentAuth.type === "oauth" ? currentAuth.access : "";
		const headers = createCodexHeaders(requestInit, accountId, accessToken, {
			model: effectiveBody?.model,
			promptCacheKey: effectiveBody?.prompt_cache_key,
		});

		const response = await fetch(url, { ...requestInit, headers });
		logRequest(LOG_STAGES.RESPONSE, {
			status: response.status,
			ok: response.ok,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers.entries()),
		});

		if (!response.ok) {
			return await handleErrorResponse(response);
		}

		const handledResponse = await handleSuccessResponse(response, hasTools);

		await recordSessionResponseFromHandledResponse({
			sessionManager,
			sessionContext: effectiveContext,
			handledResponse,
		});

		return handledResponse;
	};
}

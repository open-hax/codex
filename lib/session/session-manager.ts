import { createHash } from "node:crypto";
import { SESSION_CONFIG } from "../constants.js";
import { logDebug, logWarn } from "../logger.js";
import type { CodexResponsePayload, InputItem, RequestBody, SessionContext, SessionState } from "../types.js";
import {
	computeHash,
	itemsEqual,
	longestSharedPrefixLength,
	isSystemLike,
	extractConversationId,
	extractForkIdentifier,
	buildSessionKey,
	createSessionState,
} from "./session-utils.js";

const ENV_MARKER_REGEX =
	/<env>|<\/env>|<files>|<\/files>|here is some useful information about the environment/i;

export interface SessionManagerOptions {
	enabled: boolean;
	/**
	 * Optional override to force store=true for cached sessions
	 */
	forceStore?: boolean;
}

// Clone utilities now imported from ../utils/clone.ts

function fingerprintInputItem(item: InputItem | undefined): string | undefined {
	if (!item) return undefined;
	try {
		return createHash("sha1").update(JSON.stringify(item)).digest("hex").slice(0, 8);
	} catch {
		return undefined;
	}
}

function _summarizeRoles(items: InputItem[]): string[] {
	const roles = new Set<string>();
	for (const item of items) {
		if (typeof item.role === "string" && item.role.trim()) {
			roles.add(item.role);
		}
	}
	return Array.from(roles);
}

function _findSuffixReuseStart(previous: InputItem[], current: InputItem[]): number | null {
	if (previous.length === 0 || current.length === 0 || current.length > previous.length) {
		return null;
	}
	const start = previous.length - current.length;
	for (let index = 0; index < current.length; index += 1) {
		const prevItem = previous[start + index];
		if (!itemsEqual(prevItem, current[index])) {
			return null;
		}
	}
	return start;
}

type PrefixChangeCause = "system_prompt_changed" | "history_pruned" | "user_message_changed" | "unknown";

type PrefixChangeAnalysis = {
	cause: PrefixChangeCause;
	details: Record<string, unknown>;
};

function _analyzePrefixChange(
	previous: InputItem[],
	current: InputItem[],
	sharedPrefixLength: number,
): PrefixChangeAnalysis {
	const firstPrevious = previous[sharedPrefixLength];
	const firstIncoming = current[sharedPrefixLength];

	if (isSystemLike(firstPrevious) && isSystemLike(firstIncoming)) {
		return {
			cause: "system_prompt_changed",
			details: {
				mismatchIndex: sharedPrefixLength,
				previousFingerprint: fingerprintInputItem(firstPrevious),
				incomingFingerprint: fingerprintInputItem(firstIncoming),
				previousRole: firstPrevious.role,
				incomingRole: firstIncoming.role,
			},
		};
	}

	if (isSystemLike(firstPrevious) && !isSystemLike(firstIncoming)) {
		return {
			cause: "history_pruned",
			details: {
				mismatchIndex: sharedPrefixLength,
				previousFingerprint: fingerprintInputItem(firstPrevious),
				incomingFingerprint: fingerprintInputItem(firstIncoming),
				previousRole: firstPrevious.role,
				incomingRole: firstIncoming.role,
			},
		};
	}

	if (!isSystemLike(firstPrevious) && isSystemLike(firstIncoming)) {
		return {
			cause: "system_prompt_changed",
			details: {
				mismatchIndex: sharedPrefixLength,
				previousFingerprint: fingerprintInputItem(firstPrevious),
				incomingFingerprint: fingerprintInputItem(firstIncoming),
				previousRole: firstPrevious?.role,
				incomingRole: firstIncoming.role,
			},
		};
	}

	if (!isSystemLike(firstPrevious) && !isSystemLike(firstIncoming)) {
		return {
			cause: "user_message_changed",
			details: {
				mismatchIndex: sharedPrefixLength,
				previousFingerprint: fingerprintInputItem(firstPrevious),
				incomingFingerprint: fingerprintInputItem(firstIncoming),
				previousRole: firstPrevious?.role,
				incomingRole: firstIncoming?.role,
			},
		};
	}

	return {
		cause: "unknown",
		details: {
			mismatchIndex: sharedPrefixLength,
			previousRole: firstPrevious?.role,
			incomingRole: firstIncoming?.role,
		},
	};
}

function buildPrefixForkIds(
	baseSessionId: string,
	basePromptCacheKey: string,
	prefix: InputItem[],
): { sessionId: string; promptCacheKey: string } {
	const suffix = computeHash(prefix).slice(0, 8);
	return {
		sessionId: `${baseSessionId}::prefix::${suffix}`,
		promptCacheKey: `${basePromptCacheKey}::prefix::${suffix}`,
	};
}

export interface SessionMetricsSnapshot {
	enabled: boolean;
	totalSessions: number;
	recentSessions: Array<{
		id: string;
		promptCacheKey: string;
		lastCachedTokens: number | null;
		lastUpdated: number;
	}>;
}

export interface SessionApplyResult {
	body: RequestBody;
	context?: SessionContext;
}

export class SessionManager {
	private readonly options: SessionManagerOptions;

	private readonly sessions = new Map<string, SessionState>();

	constructor(options: SessionManagerOptions) {
		this.options = options;
	}

	public getContext(body: RequestBody): SessionContext | undefined {
		if (!this.options.enabled) {
			return undefined;
		}

		this.pruneSessions();

		const conversationId = extractConversationId(body);
		const forkId = extractForkIdentifier(body);
		if (!conversationId) {
			const hostCacheKey = body.prompt_cache_key || body.promptCacheKey;
			if (hostCacheKey && typeof hostCacheKey === "string") {
				const existingState = this.sessions.get(hostCacheKey);
				const state = existingState ?? this.resetSessionInternal(hostCacheKey);
				return state ? this.buildContext(state, !existingState) : undefined;
			}
			return undefined;
		}

		const sessionKey = buildSessionKey(conversationId, forkId);
		const existing = this.findExistingSession(sessionKey);

		if (existing) {
			const currentInput = Array.isArray(body.input) ? body.input : [];
			const analysis = this.analyzeInputChange(existing.lastInput, currentInput);
			if (analysis.cause !== "unknown") {
				logWarn("SessionManager: prefix mismatch detected", {
					sessionId: existing.id,
					prefixCause: analysis.cause,
					...analysis.details,
				});
			}

			if (analysis.cause === "system_prompt_changed") {
				const prefixForkIds = buildPrefixForkIds(existing.id, existing.promptCacheKey, existing.lastInput);
				const forkState = this.resetSessionInternal(prefixForkIds.sessionId, false);
				return forkState ? this.buildContext(forkState, true) : undefined;
			}
		}

		const state = existing || this.resetSessionInternal(sessionKey);
		return state ? this.buildContext(state, !existing) : undefined;
	}

	public recordResponse(session: string | SessionContext, response: CodexResponsePayload): void {
		if (!this.options.enabled) {
			return;
		}

		const sessionId = typeof session === "string" ? session : session.sessionId;
		const state = typeof session === "string" ? this.sessions.get(sessionId) : session.state;
		if (!state) {
			return;
		}

		const cachedTokens = response.usage?.cached_tokens;
		if (typeof cachedTokens === "number") {
			state.lastCachedTokens = cachedTokens;
			logDebug("SessionManager: response usage", {
				sessionId: state.id,
				cachedTokens,
			});
		}
		state.lastUpdated = Date.now();
	}

	public applyRequest(body: RequestBody, context?: SessionContext): SessionApplyResult {
		const clonedBody = this.cloneRequestBody(body);

		if (!this.options.enabled || !context) {
			return { body: clonedBody, context };
		}

		const existingState = this.sessions.get(context.sessionId) ?? context.state;
		if (!existingState) {
			return { body: clonedBody, context };
		}

		const nextInput = Array.isArray(clonedBody.input) ? this.cloneInputItems(clonedBody.input) : [];
		const newState: SessionState = {
			...existingState,
			lastInput: nextInput,
			lastPrefixHash: nextInput.length ? computeHash(nextInput) : null,
			lastUpdated: Date.now(),
		};
		this.sessions.set(newState.id, newState);

		const updatedContext: SessionContext = {
			...context,
			isNew: false,
			state: newState,
		};

		if (newState.promptCacheKey) {
			clonedBody.prompt_cache_key = newState.promptCacheKey;
			clonedBody.promptCacheKey = newState.promptCacheKey;
		}

		return { body: clonedBody, context: updatedContext };
	}

	public getMetrics(limit = 5): SessionMetricsSnapshot {
		this.pruneSessions();
		const maxEntries = Math.max(0, limit);
		const recentSessions = Array.from(this.sessions.values())
			.sort((a, b) => b.lastUpdated - a.lastUpdated)
			.slice(0, maxEntries)
			.map((state) => ({
				id: state.id,
				promptCacheKey: state.promptCacheKey,
				lastCachedTokens: state.lastCachedTokens ?? null,
				lastUpdated: state.lastUpdated,
			}));

		return {
			enabled: this.options.enabled,
			totalSessions: this.sessions.size,
			recentSessions,
		};
	}

	private buildContext(state: SessionState, isNew: boolean): SessionContext {
		return {
			sessionId: state.id,
			enabled: this.options.enabled,
			preserveIds: true,
			isNew,
			state,
		};
	}

	private findExistingSession(sessionKey: string): SessionState | undefined {
		const direct = this.sessions.get(sessionKey);
		let best = direct;
		const prefixRoot = `${sessionKey}::prefix::`;

		for (const [id, state] of this.sessions.entries()) {
			if (!id.startsWith(prefixRoot)) {
				continue;
			}
			if (!best || state.lastUpdated > best.lastUpdated) {
				best = state;
			}
		}

		return best;
	}

	public pruneIdleSessions(now = Date.now()): void {
		this.pruneSessions(now);
	}

	public resetSession(sessionId: string): void {
		this.resetSessionInternal(sessionId);
	}

	private pruneSessions(now = Date.now()): void {
		if (!this.options.enabled) {
			return;
		}

		for (const [sessionId, state] of this.sessions.entries()) {
			if (now - state.lastUpdated > SESSION_CONFIG.IDLE_TTL_MS) {
				this.sessions.delete(sessionId);
				logDebug("SessionManager: evicted idle session", { sessionId });
			}
		}

		if (this.sessions.size <= SESSION_CONFIG.MAX_ENTRIES) {
			return;
		}

		const victims = Array.from(this.sessions.values()).sort((a, b) => a.lastUpdated - b.lastUpdated);

		for (const victim of victims) {
			if (this.sessions.size <= SESSION_CONFIG.MAX_ENTRIES) {
				break;
			}
			if (!this.sessions.has(victim.id)) {
				continue;
			}
			this.sessions.delete(victim.id);
			logWarn("SessionManager: evicted session to enforce capacity", { sessionId: victim.id });
		}
	}

	private resetSessionInternal(sessionId: string, forceRandomKey = false): SessionState | undefined {
		const existing = this.sessions.get(sessionId);
		const state = createSessionState(sessionId, this.options.forceStore ?? false, forceRandomKey, existing);

		this.sessions.set(sessionId, state);
		return state;
	}

	private analyzeInputChange(previous: InputItem[], current: InputItem[]): PrefixChangeAnalysis {
		const normalizedPrevious = this.normalizeInputForComparison(previous);
		const normalizedCurrent = this.normalizeInputForComparison(current);
		const sharedPrefixLength = longestSharedPrefixLength(normalizedPrevious, normalizedCurrent);
		const baseAnalysis = _analyzePrefixChange(normalizedPrevious, normalizedCurrent, sharedPrefixLength);
		const details: Record<string, unknown> = {
			...baseAnalysis.details,
			sharedPrefixLength,
		};

		if (baseAnalysis.cause === "history_pruned") {
			const removedCount = Math.max(0, normalizedPrevious.length - normalizedCurrent.length);
			if (removedCount > 0) {
				details.removedCount = removedCount;
				details.removedRoles = _summarizeRoles(normalizedPrevious.slice(0, removedCount));
			}
			const suffixReuseStart = _findSuffixReuseStart(normalizedPrevious, normalizedCurrent);
			if (suffixReuseStart !== null) {
				details.suffixReuseStart = suffixReuseStart;
			}
		}

		return {
			cause: baseAnalysis.cause,
			details,
		};
	}

	private cloneRequestBody(body: RequestBody): RequestBody {
		const cloned: RequestBody = {
			...body,
			metadata: body.metadata ? { ...body.metadata } : undefined,
			include: body.include ? [...body.include] : undefined,
			text: body.text ? { ...body.text } : undefined,
			reasoning: body.reasoning ? { ...body.reasoning } : undefined,
		};

		if (Array.isArray(body.input)) {
			cloned.input = this.cloneInputItems(body.input);
		}

		return cloned;
	}

	private cloneInputItems(input: InputItem[]): InputItem[] {
		try {
			return JSON.parse(JSON.stringify(input)) as InputItem[];
		} catch {
			return input.map((item) => ({ ...item }));
		}
	}

	private normalizeInputForComparison(items: InputItem[]): InputItem[] {
		return items.filter((item) => !this.isEnvContextMessage(item));
	}

	private extractContentText(content: unknown): string {
		if (typeof content === "string") {
			return content;
		}
		if (Array.isArray(content)) {
			return content
				.map((segment) => {
					if (typeof segment === "string") {
						return segment;
					}
					if (segment && typeof segment === "object" && "text" in segment) {
						const value = (segment as { text?: unknown }).text;
						return typeof value === "string" ? value : "";
					}
					return "";
				})
				.join("\n");
		}
		return "";
	}

	private isEnvContextMessage(item: InputItem | undefined): boolean {
		if (!item || typeof item.role !== "string") {
			return false;
		}
		const role = item.role.toLowerCase();
		if (role !== "system" && role !== "developer") {
			return false;
		}

		const normalizedText = this.extractContentText(item.content).toLowerCase();
		if (!normalizedText) {
			return false;
		}

		return ENV_MARKER_REGEX.test(normalizedText);
	}
}

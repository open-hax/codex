import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PROMPT_CACHE_FORK_KEYS } from "../request/prompt-cache.js";
import type { InputItem, RequestBody, SessionState } from "../types.js";
import { formatPromptCacheKey } from "../utils/prompt-cache-key.js";

export function computeHash(items: InputItem[]): string {
	try {
		return createHash("sha1").update(JSON.stringify(items)).digest("hex");
	} catch {
		const roleSummary = items
			.map((item) => {
				if (typeof item?.role === "string" && item.role.trim()) {
					return item.role.trim().toLowerCase();
				}
				if (typeof (item as { id?: unknown }).id === "string") {
					return `id:${(item as { id: string }).id}`;
				}
				return typeof item;
			})
			.join("|");
		const nonce = randomBytes(8).toString("hex");
		return createHash("sha1").update(`fallback_${items.length}_${roleSummary}_${nonce}`).digest("hex");
	}
}

export function itemsEqual(a: InputItem | undefined, b: InputItem | undefined): boolean {
	try {
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		return false;
	}
}

export function longestSharedPrefixLength(previous: InputItem[], current: InputItem[]): number {
	if (previous.length === 0 || current.length === 0) {
		return 0;
	}

	const limit = Math.min(previous.length, current.length);
	let length = 0;

	for (let i = 0; i < limit; i += 1) {
		if (!itemsEqual(previous[i], current[i])) {
			break;
		}
		length += 1;
	}

	return length;
}

export function sanitizeCacheKey(candidate: string): string {
	const trimmed = candidate.trim();
	if (trimmed.length === 0) {
		return `cache_${randomUUID()}`;
	}
	return trimmed;
}

export function isSystemLike(item: InputItem | undefined): boolean {
	if (!item || typeof item.role !== "string") {
		return false;
	}
	const role = item.role.toLowerCase();
	return role === "system" || role === "developer";
}

export function isToolMessage(item: InputItem | undefined): boolean {
	if (!item) return false;
	const role = typeof item.role === "string" ? item.role.toLowerCase() : "";
	const type = typeof item.type === "string" ? item.type.toLowerCase() : "";
	return role === "tool" || type === "tool_call" || type === "tool_result";
}

export function extractConversationId(body: RequestBody): string | undefined {
	const metadata = body.metadata as Record<string, unknown> | undefined;
	const bodyAny = body as Record<string, unknown>;
	const possibleKeys = [
		"conversation_id",
		"conversationId",
		"thread_id",
		"threadId",
		"session_id",
		"sessionId",
		"chat_id",
		"chatId",
	];

	for (const key of possibleKeys) {
		const fromMetadata = metadata?.[key];
		if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
			return fromMetadata;
		}

		const fromBody = bodyAny[key];
		if (typeof fromBody === "string" && fromBody.length > 0) {
			return fromBody;
		}
	}

	return undefined;
}

export function extractForkIdentifier(body: RequestBody): string | undefined {
	const metadata = body.metadata as Record<string, unknown> | undefined;
	const bodyAny = body as Record<string, unknown>;
	const normalize = (value: unknown): string | undefined => {
		if (typeof value !== "string") {
			return undefined;
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	};

	for (const key of PROMPT_CACHE_FORK_KEYS) {
		const fromMetadata = normalize(metadata?.[key]);
		if (fromMetadata) {
			return fromMetadata;
		}
		const fromBody = normalize(bodyAny[key]);
		if (fromBody) {
			return fromBody;
		}
	}

	return undefined;
}

export function buildSessionKey(conversationId: string, forkId: string | undefined): string {
	if (!forkId) {
		return conversationId;
	}
	return `${conversationId}::fork::${forkId}`;
}

// Keep in sync with ensurePromptCacheKey logic in request-transformer.ts so session-managed
// and stateless flows derive identical cache keys.
export function buildPromptCacheKey(conversationId: string, forkId: string | undefined): string {
	return formatPromptCacheKey(conversationId, forkId, {
		prefix: "",
		forkDelimiter: "::fork::",
		sanitizeBase: sanitizeCacheKey,
		sanitizeFork: sanitizeCacheKey,
	});
}

export function createSessionState(
	sessionId: string,
	forceStore: boolean,
	forceRandomKey = false,
	existing?: SessionState,
): SessionState {
	const keySeed = existing?.id ?? sessionId;
	const promptCacheKey = forceRandomKey ? `cache_${randomUUID()}` : sanitizeCacheKey(keySeed);

	return {
		id: sessionId,
		promptCacheKey,
		store: forceStore,
		lastInput: [],
		lastPrefixHash: null,
		lastUpdated: Date.now(),
	};
}

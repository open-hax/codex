import { randomUUID } from "node:crypto";

export interface PromptCacheKeyOptions {
	/** Prefix to prepend to the sanitized base (default: "cache_") */
	prefix?: string;
	/** Delimiter that separates the base from the fork id (default: "-fork-") */
	forkDelimiter?: string;
	/** Custom base sanitizer. Defaults to trimming + collapsing whitespace. */
	sanitizeBase?: (value: string) => string;
	/** Custom fork sanitizer. Defaults to trimming + collapsing whitespace. */
	sanitizeFork?: (value: string) => string;
}

function defaultSanitizeBase(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return randomUUID();
	}
	return trimmed.replace(/\s+/g, "-");
}

function defaultSanitizeFork(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return `fork-${randomUUID()}`;
	}
	return trimmed.replace(/\s+/g, "-");
}

export function formatPromptCacheKey(
	base: string,
	forkId?: string,
	options: PromptCacheKeyOptions = {},
): string {
	const sanitizeBase = options.sanitizeBase ?? defaultSanitizeBase;
	const sanitizeFork = options.sanitizeFork ?? defaultSanitizeFork;
	const prefix = options.prefix ?? "cache_";
	const forkDelimiter = options.forkDelimiter ?? "-fork-";

	const sanitizedBase = sanitizeBase(base);
	const baseWithPrefix = prefix
		? sanitizedBase.startsWith(prefix)
			? sanitizedBase
			: `${prefix}${sanitizedBase}`
		: sanitizedBase;

	if (!forkId) {
		return baseWithPrefix;
	}

	const sanitizedFork = sanitizeFork(forkId);
	return `${baseWithPrefix}${forkDelimiter}${sanitizedFork}`;
}

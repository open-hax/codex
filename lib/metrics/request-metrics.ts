export type RequestMetricsSnapshot = {
	totalRequests: number;
	promptCacheKey: {
		withKey: number;
		withoutKey: number;
	};
	tools: {
		requestsWithTools: number;
		totalTools: number;
		toolChoiceCounts: Record<string, number>;
		parallelToolCalls: number;
	};
	models: Record<string, number>;
	reasoning: {
		withReasoning: number;
		effort: Record<string, number>;
		summary: Record<string, number>;
		textVerbosity: Record<string, number>;
	};
	recentRequests: RequestSummary[];
};

export type RequestSummary = {
	timestamp: number;
	url: string;
	model?: string;
	promptCacheKey: boolean;
	toolCount: number;
	toolChoice?: string;
	parallelToolCalls?: boolean;
	include?: string[];
	store?: boolean;
	reasoningEffort?: string;
	reasoningSummary?: string;
	textVerbosity?: string;
};

export type RequestMetricsInput = {
	url: string;
	model?: string;
	promptCacheKey: boolean;
	toolCount: number;
	toolChoice?: string;
	parallelToolCalls?: boolean;
	include?: string[];
	store?: boolean;
	reasoningEffort?: string;
	reasoningSummary?: string;
	textVerbosity?: string;
};

const MAX_RECENT_REQUESTS = 50;

class RequestMetricsCollector {
	private totalRequests = 0;
	private promptCacheWith = 0;
	private promptCacheWithout = 0;
	private toolRequests = 0;
	private totalTools = 0;
	private toolChoiceCounts: Record<string, number> = {};
	private parallelToolCalls = 0;
	private models: Record<string, number> = {};
	private reasoningEffort: Record<string, number> = {};
	private reasoningSummary: Record<string, number> = {};
	private textVerbosity: Record<string, number> = {};
	private reasoningWith = 0;
	private recentRequests: RequestSummary[] = [];

	recordRequest(input: RequestMetricsInput): void {
		this.totalRequests += 1;

		if (input.promptCacheKey) {
			this.promptCacheWith += 1;
		} else {
			this.promptCacheWithout += 1;
		}

		if (input.toolCount > 0) {
			this.toolRequests += 1;
			this.totalTools += input.toolCount;
		}

		if (input.toolChoice) {
			this.toolChoiceCounts[input.toolChoice] = (this.toolChoiceCounts[input.toolChoice] ?? 0) + 1;
		}

		if (input.parallelToolCalls) {
			this.parallelToolCalls += 1;
		}

		if (input.model) {
			this.models[input.model] = (this.models[input.model] ?? 0) + 1;
		}

		if (input.reasoningEffort || input.reasoningSummary || input.textVerbosity) {
			this.reasoningWith += 1;
		}

		if (input.reasoningEffort) {
			this.reasoningEffort[input.reasoningEffort] = (this.reasoningEffort[input.reasoningEffort] ?? 0) + 1;
		}

		if (input.reasoningSummary) {
			this.reasoningSummary[input.reasoningSummary] =
				(this.reasoningSummary[input.reasoningSummary] ?? 0) + 1;
		}

		if (input.textVerbosity) {
			this.textVerbosity[input.textVerbosity] = (this.textVerbosity[input.textVerbosity] ?? 0) + 1;
		}

		const summary: RequestSummary = {
			timestamp: Date.now(),
			url: input.url,
			model: input.model,
			promptCacheKey: input.promptCacheKey,
			toolCount: input.toolCount,
			toolChoice: input.toolChoice,
			parallelToolCalls: input.parallelToolCalls,
			include: input.include,
			store: input.store,
			reasoningEffort: input.reasoningEffort,
			reasoningSummary: input.reasoningSummary,
			textVerbosity: input.textVerbosity,
		};

		this.recentRequests.push(summary);
		if (this.recentRequests.length > MAX_RECENT_REQUESTS) {
			this.recentRequests.shift();
		}
	}

	getSnapshot(): RequestMetricsSnapshot {
		return {
			totalRequests: this.totalRequests,
			promptCacheKey: {
				withKey: this.promptCacheWith,
				withoutKey: this.promptCacheWithout,
			},
			tools: {
				requestsWithTools: this.toolRequests,
				totalTools: this.totalTools,
				toolChoiceCounts: { ...this.toolChoiceCounts },
				parallelToolCalls: this.parallelToolCalls,
			},
			models: { ...this.models },
			reasoning: {
				withReasoning: this.reasoningWith,
				effort: { ...this.reasoningEffort },
				summary: { ...this.reasoningSummary },
				textVerbosity: { ...this.textVerbosity },
			},
			recentRequests: [...this.recentRequests],
		};
	}

	reset(): void {
		this.totalRequests = 0;
		this.promptCacheWith = 0;
		this.promptCacheWithout = 0;
		this.toolRequests = 0;
		this.totalTools = 0;
		this.toolChoiceCounts = {};
		this.parallelToolCalls = 0;
		this.models = {};
		this.reasoningEffort = {};
		this.reasoningSummary = {};
		this.textVerbosity = {};
		this.reasoningWith = 0;
		this.recentRequests = [];
	}
}

const requestMetricsCollector = new RequestMetricsCollector();

export function recordRequestMetrics(input: RequestMetricsInput): void {
	requestMetricsCollector.recordRequest(input);
}

export function getRequestMetricsSnapshot(): RequestMetricsSnapshot {
	return requestMetricsCollector.getSnapshot();
}

export function resetRequestMetrics(): void {
	requestMetricsCollector.reset();
}

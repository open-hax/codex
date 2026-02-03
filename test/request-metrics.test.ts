import { beforeEach, describe, expect, it } from "vitest";
import {
	getRequestMetricsSnapshot,
	recordRequestMetrics,
	resetRequestMetrics,
} from "../lib/metrics/request-metrics.js";

describe("request metrics", () => {
	beforeEach(() => {
		resetRequestMetrics();
	});

	it("tracks basic counts and recent requests", () => {
		recordRequestMetrics({
			url: "https://chatgpt.com/backend-api/codex/responses",
			model: "gpt-5",
			promptCacheKey: true,
			toolCount: 2,
			toolChoice: "required",
			parallelToolCalls: true,
			include: ["reasoning.encrypted_content"],
			store: false,
			reasoningEffort: "high",
			reasoningSummary: "auto",
			textVerbosity: "medium",
		});

		const snapshot = getRequestMetricsSnapshot();
		expect(snapshot.totalRequests).toBe(1);
		expect(snapshot.promptCacheKey.withKey).toBe(1);
		expect(snapshot.promptCacheKey.withoutKey).toBe(0);
		expect(snapshot.tools.requestsWithTools).toBe(1);
		expect(snapshot.tools.totalTools).toBe(2);
		expect(snapshot.tools.toolChoiceCounts.required).toBe(1);
		expect(snapshot.tools.parallelToolCalls).toBe(1);
		expect(snapshot.models["gpt-5"]).toBe(1);
		expect(snapshot.reasoning.withReasoning).toBe(1);
		expect(snapshot.reasoning.effort.high).toBe(1);
		expect(snapshot.reasoning.summary.auto).toBe(1);
		expect(snapshot.reasoning.textVerbosity.medium).toBe(1);
		expect(snapshot.recentRequests).toHaveLength(1);
		expect(snapshot.recentRequests[0].toolCount).toBe(2);
	});

	it("limits recent requests to max capacity", () => {
		for (let index = 0; index < 60; index += 1) {
			recordRequestMetrics({
				url: `https://example.com/${index}`,
				model: "gpt-5",
				promptCacheKey: index % 2 === 0,
				toolCount: 0,
			});
		}

		const snapshot = getRequestMetricsSnapshot();
		expect(snapshot.recentRequests.length).toBeLessThanOrEqual(50);
		expect(snapshot.totalRequests).toBe(60);
	});

	it("handles requests without optional fields", () => {
		recordRequestMetrics({
			url: "https://chatgpt.com/backend-api/codex/responses",
			promptCacheKey: false,
			toolCount: 0,
		});

		const snapshot = getRequestMetricsSnapshot();
		expect(snapshot.totalRequests).toBe(1);
		expect(snapshot.promptCacheKey.withoutKey).toBe(1);
		expect(snapshot.tools.requestsWithTools).toBe(0);
		expect(snapshot.models).toEqual({});
		expect(snapshot.recentRequests[0].model).toBeUndefined();
	});

	it("tracks per-model distributions", () => {
		const models = [
			{ name: "gpt-5", count: 1 },
			{ name: "gpt-5.1", count: 2 },
			{ name: "gpt-5.2", count: 3 },
		];

		for (const { name, count } of models) {
			for (let idx = 0; idx < count; idx += 1) {
				recordRequestMetrics({
					url: `https://example.com/${name}/${idx}`,
					model: name,
					promptCacheKey: true,
					toolCount: 0,
				});
			}
		}

		const snapshot = getRequestMetricsSnapshot();
		for (const { name, count } of models) {
			expect(snapshot.models[name]).toBe(count);
		}
		expect(snapshot.totalRequests).toBe(models.reduce((sum, entry) => sum + entry.count, 0));
	});
});

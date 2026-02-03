import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { logInfo, logWarn } from "../logger.js";
import { getCachePerformanceReport } from "../cache/cache-metrics.js";
import { getRequestMetricsSnapshot } from "../metrics/request-metrics.js";

const LOCALHOST = "127.0.0.1";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
	res.statusCode = status;
	res.setHeader("content-type", "text/html; charset=utf-8");
	res.end(html);
}

function buildIndexHtml(): string {
	return [
		"<!doctype html>",
		'<html lang="en">',
		"<head>",
		'<meta charset="utf-8">',
		"<title>Codex Dashboard</title>",
		"<style>",
		"body { font-family: sans-serif; margin: 24px; }",
		"section { margin-bottom: 24px; }",
		"table { border-collapse: collapse; width: 100%; }",
		"th, td { border: 1px solid #ddd; padding: 8px; font-size: 14px; }",
		"th { background: #f5f5f5; text-align: left; }",
		"code { font-size: 13px; }",
		"</style>",
		"</head>",
		"<body>",
		"<h1>Codex Dashboard</h1>",
		"<p>Local-only dashboard. Data auto-refreshes every 5s.</p>",
		"<section>",
		"<h2>Metrics</h2>",
		'<pre id="metrics">Loading...</pre>',
		"</section>",
		"<section>",
		"<h2>Recent Requests</h2>",
		"<table>",
		"<thead><tr><th>Time</th><th>Model</th><th>URL</th><th>Prompt Cache</th><th>Tools</th><th>Reasoning</th></tr></thead>",
		'<tbody id="recent"></tbody>',
		"</table>",
		"</section>",
		"<script>",
		'const ESCAPE_LOOKUP = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };',
		'ESCAPE_LOOKUP[\'"\'] = "&quot;";',
		'ESCAPE_LOOKUP["\'"] = "&#39;";',
		"function escapeHtml(value) {",
		"  return String(value ?? '').replace(/[&<>\\\"']/g, (char) => ESCAPE_LOOKUP[char] || char);",
		"}",

		"async function load() {",

		"  try {",
		"    const metrics = await fetch('/metrics').then(r => r.json());",
		"    const recent = await fetch('/recent').then(r => r.json());",
		"    document.getElementById('metrics').textContent = JSON.stringify(metrics, null, 2);",
		"    const tbody = document.getElementById('recent');",
		"    tbody.innerHTML = '';",
		"    for (const item of (recent.recentRequests || [])) {",
		"      const tr = document.createElement('tr');",
		"      const ts = new Date(item.timestamp).toLocaleTimeString();",
		"      const model = item.model || '';",
		"      const url = item.url ? item.url : '';",
		"      const cache = item.promptCacheKey ? 'yes' : 'no';",
		"      const tools = item.toolCount + (item.toolChoice ? ' (' + item.toolChoice + ')' : '');",
		"      const reasoning = (item.reasoningEffort || item.reasoningSummary || item.textVerbosity) ? 'yes' : 'no';",
		"      const safeTs = escapeHtml(ts);",
		"      const safeModel = escapeHtml(model);",
		"      const safeUrl = escapeHtml(url);",
		"      const safeCache = escapeHtml(cache);",
		"      const safeTools = escapeHtml(tools);",
		"      const safeReasoning = escapeHtml(reasoning);",
		"      tr.innerHTML = '<td>' + safeTs + '</td>' + '<td>' + safeModel + '</td>' + '<td><code>' + safeUrl + '</code></td>' + '<td>' + safeCache + '</td>' + '<td>' + safeTools + '</td>' + '<td>' + safeReasoning + '</td>';",
		"      tbody.appendChild(tr);",
		"    }",
		"  } catch (err) {",
		"    document.getElementById('metrics').textContent = 'Failed to load metrics';",
		"  }",
		"}",
		"load();",
		"setInterval(load, 5000);",
		"</script>",
		"</body>",
		"</html>",
	].join("\n");
}

function handleMetrics(_: IncomingMessage, res: ServerResponse): void {
	const cacheReport = getCachePerformanceReport();
	const requestMetrics = getRequestMetricsSnapshot();
	sendJson(res, 200, { cacheReport, requestMetrics });
}

function handleRecent(_: IncomingMessage, res: ServerResponse): void {
	const requestMetrics = getRequestMetricsSnapshot();
	sendJson(res, 200, { recentRequests: requestMetrics.recentRequests });
}

function handleHealth(_: IncomingMessage, res: ServerResponse): void {
	sendJson(res, 200, { status: "ok" });
}

function handleIndex(_: IncomingMessage, res: ServerResponse): void {
	sendHtml(res, 200, buildIndexHtml());
}

function route(req: IncomingMessage, res: ServerResponse): void {
	const url = req.url ? new URL(req.url, "http://localhost") : null;
	const path = url?.pathname || "/";

	switch (path) {
		case "/metrics":
			handleMetrics(req, res);
			return;
		case "/recent":
			handleRecent(req, res);
			return;
		case "/health":
			handleHealth(req, res);
			return;
		case "/":
			handleIndex(req, res);
			return;
		default:
			sendJson(res, 404, { error: "not found" });
	}
}

let serverStarted = false;
let serverPort: number | null = null;

export function startDashboardServer(): void {
	if (serverStarted) return;
	if (process.env.NODE_ENV === "test") return;

	try {
		const server = createServer(route);
		server.listen(0, LOCALHOST, () => {
			const address = server.address();
			if (address && typeof address === "object") {
				serverPort = address.port;
				logInfo("Codex dashboard server listening", { url: `http://${LOCALHOST}:${serverPort}` });
			}
		});
		server.on("error", (error) => {
			logWarn("Codex dashboard server failed to start", {
				error: error instanceof Error ? error.message : String(error),
			});
		});
		serverStarted = true;
	} catch (error) {
		logWarn("Codex dashboard server initialization failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export function getDashboardPort(): number | null {
	return serverPort;
}

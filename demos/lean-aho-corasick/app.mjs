/**
 * Drives the interactive Aho–Corasick signal scanner and its browser benchmark.
 *
 * @file
 */

import { prepareMatcher, ready, unpackMatches } from "./runtime.mjs";
import { attachBrowserBenchmark, measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

const byId = id => document.getElementById(id);
const elements = {
	highlighted: byId("highlighted-text")
	, input: byId("input")
	, inputNote: byId("input-note")
	, matchCount: byId("match-count")
	, overlapCount: byId("overlap-count")
	, patterns: byId("patterns")
	, results: byId("pattern-results")
	, runtime: byId("runtime-status")
	, scanTime: byId("scan-time")
	, showAll: byId("show-all")
	, verdictCopy: byId("verdict-copy")
	, verdictTitle: byId("verdict-title")
};
const encoder = new TextEncoder();
const palette = ["#c6a0ff", "#72d8ff", "#adf7b6", "#ffd36e", "#ff8b7b", "#ff9fba", "#8ee6c1", "#9eb8ff"];
const scenarios = {
	operations: {
		patterns: ["ERROR", "timeout", "database timeout", "retry", "retry exhausted", "worker-07"]
		, text: "10:42:17 worker-07 WARNING retry 2/3\n10:42:19 worker-07 ERROR database timeout\n10:42:20 worker-07 ERROR retry exhausted"
	}
	, moderation: {
		patterns: ["spoiler", "ending spoiler", "leak", "credential leak", "credential leak"]
		, text: "Queue item 184: possible ending spoiler.\nQueue item 185: report says credential leak; escalate leak review."
	}
	, threats: {
		patterns: ["../", "../../", "/etc/passwd", "cmd=", "powershell", "token=", "admin"]
		, text: "GET /download?file=../../etc/passwd\nPOST /admin/run cmd=powershell token=redacted"
	}
};

let matcher;
let patterns = [];
let matches = [];
let selectedPattern = null;
let revision = 0;
let updateTimer = 0;

const readPatterns = () => elements.patterns.value.split("\n").map(value => value.trim()).filter(Boolean);
const byteCharacters = text => {
	const result = [];
	let position = 0;
	for(const value of text)
	{
		const length = encoder.encode(value).length;
		result.push({ value, start: position, stop: position + length });
		position += length;
	}
	return result;
};
const selectedMatches = () => selectedPattern === null ? matches : matches.filter(hit => hit.pattern === selectedPattern);

const render = () => {
	const visible = selectedMatches();
	const characters = byteCharacters(elements.input.value);
	const coverage = new Uint16Array(encoder.encode(elements.input.value).length);
	for(const hit of matches) for(let index = hit.start; index < hit.stop; index += 1) coverage[index] += 1;
	let overlapBytes = 0;
	for(const depth of coverage) if(depth > 1) overlapBytes += 1;
	elements.matchCount.textContent = String(matches.length);
	elements.overlapCount.textContent = String(overlapBytes);
	elements.verdictTitle.textContent = matches.length === 0 ? "No configured signal appears."
		: `${matches.length} exact ${matches.length === 1 ? "match" : "matches"} found.`;
	elements.verdictCopy.textContent = overlapBytes > 0
		? `${overlapBytes} byte positions belong to more than one signature. Nothing was deduplicated.`
		: "Each returned span names the exact pattern and byte range that matched.";
	elements.showAll.disabled = selectedPattern === null;
	elements.highlighted.replaceChildren(...characters.map(character => {
		const allHits = matches.filter(hit => hit.start < character.stop && hit.stop > character.start);
		const shownHits = visible.filter(hit => hit.start < character.stop && hit.stop > character.start);
		const span = document.createElement("span");
		span.className = `char${allHits.length ? " matched" : ""}${allHits.length && !shownHits.length ? " muted-match" : ""}`;
		span.textContent = character.value;
		span.style.setProperty("--depth", String(Math.min(4, allHits.length)));
		const colorIndex = shownHits[0]?.pattern ?? allHits[0]?.pattern;
		if(colorIndex !== undefined) span.style.setProperty("--hit-color", palette[colorIndex % palette.length]);
		if(allHits.length) span.title = allHits.map(hit => `${patterns[hit.pattern]} [${hit.start}, ${hit.stop})`).join("\n");
		return span;
	}));
	const counts = new Uint32Array(patterns.length);
	for(const hit of matches) counts[hit.pattern] += 1;
	elements.results.replaceChildren(...patterns.map((pattern, index) => {
		const button = document.createElement("button");
		button.className = `pattern-chip${selectedPattern === index ? " active" : ""}${counts[index] === 0 ? " zero" : ""}`;
		button.style.setProperty("--hit-color", palette[index % palette.length]);
		const swatch = document.createElement("i");
		const name = document.createElement("span");
		name.textContent = pattern;
		const count = document.createElement("b");
		count.textContent = String(counts[index]);
		button.append(swatch, name, count);
		button.addEventListener("click", () => { selectedPattern = selectedPattern === index ? null : index; render(); });
		return button;
	}));
};

const scan = () => {
	if(!matcher) return;
	const started = performance.now();
	matches = unpackMatches(matcher.scanBytes(elements.input.value));
	elements.scanTime.textContent = `${(performance.now() - started).toFixed(2)} ms`;
	render();
};

const compileAndScan = async () => {
	const current = ++revision;
	const nextPatterns = readPatterns();
	if(nextPatterns.length === 0)
	{
		elements.verdictTitle.textContent = "Add at least one pattern.";
		elements.verdictCopy.textContent = "Blank lines are ignored; empty patterns are rejected explicitly.";
		return;
	}
	try
	{
		const next = await prepareMatcher(nextPatterns);
		if(current !== revision)
		{ next.dispose(); return; }
		matcher?.dispose();
		matcher = next;
		patterns = nextPatterns;
		selectedPattern = null;
		scan();
	}
	catch(error)
	{
		elements.verdictTitle.textContent = "These patterns could not be compiled.";
		elements.verdictCopy.textContent = error instanceof Error ? error.message : String(error);
		console.error(error);
	}
};

const scheduleCompile = () => { clearTimeout(updateTimer); updateTimer = setTimeout(() => void compileAndScan(), 160); };
const scheduleScan = () => { clearTimeout(updateTimer); updateTimer = setTimeout(scan, 55); };
const loadScenario = name => {
	const scenario = scenarios[name];
	elements.patterns.value = scenario.patterns.join("\n");
	elements.input.value = scenario.text;
	for(const button of document.querySelectorAll("[data-scenario]")) button.setAttribute("aria-pressed", String(button.dataset.scenario === name));
	void compileAndScan();
};

for(const button of document.querySelectorAll("[data-scenario]")) button.addEventListener("click", () => loadScenario(button.dataset.scenario));
elements.patterns.addEventListener("input", scheduleCompile);
elements.input.addEventListener("input", scheduleScan);
elements.showAll.addEventListener("click", () => { selectedPattern = null; render(); });

const benchmarkPatterns = ["error", "warning", "timeout", "connection", "denied", "retry", "failed", "exception", "trace", "request", "response", "database", "cache", "worker", "queue", "critical", "error: timeout", "connection denied", "retry failed", "database error", "worker timeout", "warn", "failure", "fail", "timed out", "permission denied", "unavailable", "panic"];
const benchmarkInput = encoder.encode("INFO request accepted; WARNING cache retry failed; ERROR: timeout while database connection denied. ".repeat(42));
const buildJavaScriptMatcher = values => {
	const encoded = values.map(value => encoder.encode(value));
	const nodes = [{ next: new Int32Array(256).fill(-1), fail: 0, output: [] }];
	encoded.forEach((pattern, patternIndex) => {
		let state = 0;
		for(const token of pattern)
		{
			if(nodes[state].next[token] < 0)
{ nodes[state].next[token] = nodes.length; nodes.push({ next: new Int32Array(256).fill(-1), fail: 0, output: [] }); }
			state = nodes[state].next[token];
		}
		nodes[state].output.push(patternIndex);
	});
	const queue = [];
	for(let token = 0; token < 256; token += 1)
	{
		const child = nodes[0].next[token];
		if(child < 0) nodes[0].next[token] = 0; else
		{ nodes[child].fail = 0; queue.push(child); }
	}
	for(let head = 0; head < queue.length; head += 1)
	{
		const state = queue[head];
		for(let token = 0; token < 256; token += 1)
		{
			const child = nodes[state].next[token];
			if(child < 0) nodes[state].next[token] = nodes[nodes[state].fail].next[token];
			else
			{ nodes[child].fail = nodes[nodes[state].fail].next[token]; nodes[child].output.push(...nodes[nodes[child].fail].output); queue.push(child); }
		}
	}
	return input => {
		const output = [];
		let state = 0;
		for(let index = 0; index < input.length; index += 1)
		{
			state = nodes[state].next[input[index]];
			for(const pattern of nodes[state].output) output.push(pattern, index + 1 - encoded[pattern].length, index + 1);
		}
		return output;
	};
};
const benchmarkMatcher = prepareMatcher(benchmarkPatterns);
const javascriptMatcher = buildJavaScriptMatcher(benchmarkPatterns);
attachBrowserBenchmark({
	root: document.querySelector("#browser-benchmark")
	, prepare: () => benchmarkMatcher
	, sample: async index => {
		const prepared = await benchmarkMatcher;
		let lean;
		let javascript;
		if(index % 2 === 0)
		{ lean = measureSyncBenchmark(() => prepared.scanBytes(benchmarkInput)); javascript = measureSyncBenchmark(() => javascriptMatcher(benchmarkInput)); }
		else
		{ javascript = measureSyncBenchmark(() => javascriptMatcher(benchmarkInput)); lean = measureSyncBenchmark(() => prepared.scanBytes(benchmarkInput)); }
		if(lean.result.length !== javascript.result.length) throw new Error("The benchmark match counts disagree");
		return { javascriptMs: javascript.milliseconds, leanMs: lean.milliseconds };
	}
	, summarize: ({ ratio, trialCount }) => `${trialCount} exact scans agreed · 28 patterns · 4,200 bytes · median paired cost ${ratio.toFixed(1)}×`
});

loadScenario("operations");
try
{ await ready(); elements.runtime.textContent = "Lean/Wasm ready"; }
catch(error)
{ elements.runtime.textContent = "Lean/Wasm failed to load"; console.error(error); }

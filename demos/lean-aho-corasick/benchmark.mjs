/**
 * Measures checked Lean batch and streaming scans against a typed-array JavaScript automaton.
 *
 * @file
 */

import { performance } from "node:perf_hooks";
import { prepareMatcher } from "./runtime.mjs";

const assertBudgets = process.argv.includes("--assert");
const iterations = Number.parseInt(process.env.LEAN_AHO_BENCH_ITERATIONS || "30", 10);
const patterns = [
	"error"
	, "warning"
	, "timeout"
	, "connection"
	, "denied"
	, "retry"
	, "failed"
	, "exception"
	, "trace"
	, "request"
	, "response"
	, "database"
	, "cache"
	, "worker"
	, "queue"
	, "critical"
	, "error: timeout"
	, "connection denied"
	, "retry failed"
	, "database error"
	, "worker timeout"
	, "warn"
	, "failure"
	, "fail"
	, "timed out"
	, "permission denied"
	, "unavailable"
	, "panic"
];
const line = "INFO request accepted; WARNING cache retry failed; ERROR: timeout while database connection denied. ";
const input = new TextEncoder().encode(line.repeat(42));
const encoded = patterns.map(pattern => new TextEncoder().encode(pattern));

const buildJavaScriptMatcher = () => {
	const nodes = [{ next: new Int32Array(256).fill(-1), fail: 0, output: [] }];
	encoded.forEach((pattern, patternIndex) => {
		let state = 0;
		for(const token of pattern)
		{
			if(nodes[state].next[token] < 0)
			{
				nodes[state].next[token] = nodes.length;
				nodes.push({ next: new Int32Array(256).fill(-1), fail: 0, output: [] });
			}
			state = nodes[state].next[token];
		}
		nodes[state].output.push(patternIndex);
	});
	const queue = [];
	for(let token = 0; token < 256; token += 1)
	{
		const child = nodes[0].next[token];
		if(child < 0) nodes[0].next[token] = 0;
		else queue.push(child);
	}
	for(let head = 0; head < queue.length; head += 1)
	{
		const state = queue[head];
		for(let token = 0; token < 256; token += 1)
		{
			const child = nodes[state].next[token];
			if(child < 0) nodes[state].next[token] = nodes[nodes[state].fail].next[token];
			else
			{
				nodes[child].fail = nodes[nodes[state].fail].next[token];
				nodes[child].output.push(...nodes[nodes[child].fail].output);
				queue.push(child);
			}
		}
	}
	return text => {
		const output = [];
		let state = 0;
		for(let index = 0; index < text.length; index += 1)
		{
			state = nodes[state].next[text[index]];
			for(const pattern of nodes[state].output)
				output.push(pattern, index + 1 - encoded[pattern].length, index + 1);
		}
		return output;
	};
};

const measure = operation => {
	for(let index = 0; index < 5; index += 1) operation();
	const samples = [];
	for(let index = 0; index < iterations; index += 1)
	{
		const started = performance.now(); operation(); samples.push(performance.now() - started);
	}
	samples.sort((a, b) => a - b);
	return { medianMs: samples[Math.floor(samples.length / 2)], p95Ms: samples[Math.floor(samples.length * .95)] };
};

const matcher = await prepareMatcher(patterns);
const javascriptScan = buildJavaScriptMatcher();
const lean = measure(() => matcher.scanBytes(input));
const javascript = measure(() => javascriptScan(input));
const chunks = Array.from({ length: Math.ceil(input.length / 256) }, (_, index) => input.slice(index * 256, (index + 1) * 256));
const leanStreaming = measure(() => { const stream = matcher.createStream(); for(const chunk of chunks) stream.push(chunk); });
const ratio = lean.medianMs / javascript.medianMs;
if(assertBudgets && lean.medianMs > 10) throw new Error("batch median exceeded 10 ms");
if(assertBudgets && leanStreaming.medianMs > 12) throw new Error("streaming median exceeded 12 ms");
if(assertBudgets && ratio > 100) throw new Error("relative batch cost exceeded 100x");
process.stdout.write(`${patterns.length} patterns / ${input.length} bytes: Lean batch ${lean.medianMs.toFixed(2)} ms, `
	+ `Lean stream ${leanStreaming.medianMs.toFixed(2)} ms, JS ${javascript.medianMs.toFixed(2)} ms, ${ratio.toFixed(1)}x relative cost\n`);

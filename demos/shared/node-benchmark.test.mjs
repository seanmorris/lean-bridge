/**
 * Deterministic contracts for paired command-line benchmark sampling.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { measurePairedBenchmark } from "./node-benchmark.mjs";

test("paired batches discard warmup timings and alternate order without timing result checks", async () => {
	const events = [];
	let pair = 0;
	const result = await measurePairedBenchmark(() => "left", () => "right", {
		iterations: 3, warmupCount: 2, minimumMs: 12
		, sample: (operation, minimumMs) => {
			assert.equal(minimumMs, 12);
			const side = operation();
			events.push(side);
			return { result: side, milliseconds: pair < 2 ? 999 : (side === "left" ? 2 : 1) * (pair - 1) };
		}
		, check: (left, right) => {
			assert.equal(left, "left");
			assert.equal(right, "right");
			events.push("check");
		}
		, pause: async () => { events.push("yield"); pair += 1; }
	});
	assert.deepEqual(events, [
		"left", "right", "check", "yield", "right", "left", "check", "yield"
		, "left", "right", "check", "yield", "right", "left", "check", "yield"
		, "left", "right", "check", "yield"
	]);
	assert.deepEqual(result, { left: { medianMs: 4, p95Ms: 6 }, right: { medianMs: 2, p95Ms: 3 } });
});

test("paired benchmarks reject invalid counts and invalid measured times", async () => {
	const operation = () => { throw new Error("Invalid settings must fail before measurement"); };
	for(const value of [0, -1, 1.5, NaN, Infinity, "50"])
		for(const field of ["iterations", "warmupCount"])
			await assert.rejects(measurePairedBenchmark(operation, operation, { [field]: value }), RangeError);
	for(const minimumMs of [0, -1, NaN, Infinity])
		await assert.rejects(measurePairedBenchmark(operation, operation, { minimumMs }), RangeError);
	for(const milliseconds of [0, -1, NaN, Infinity])
		await assert.rejects(measurePairedBenchmark(() => 1, () => 1, {
			iterations: 1, warmupCount: 1, sample: () => ({ milliseconds, result: 1 })
		}), /positive and finite/u);
});

test("paired benchmarks fail on incorrect results even during warmup", async () => {
	await assert.rejects(measurePairedBenchmark(() => 1, () => 2, {
		iterations: 1, warmupCount: 1
		, sample: operation => ({ milliseconds: 1, result: operation() })
		, check: (left, right) => assert.equal(left, right)
		, pause: async () => { throw new Error("Do not continue after mismatched results"); }
	}), assert.AssertionError);
});

test("paired benchmarks use the real batched measurement by default", async () => {
	let leftCalls = 0;
	let rightCalls = 0;
	let checks = 0;
	const result = await measurePairedBenchmark(() => ++leftCalls, () => ++rightCalls, {
		iterations: 1, warmupCount: 1, minimumMs: .1
		, check: (left, right) => {
			assert.equal(left, leftCalls);
			assert.equal(right, rightCalls);
			checks += 1;
		}
	});
	assert.equal(checks, 2);
	assert.ok(leftCalls >= 2 && rightCalls >= 2);
	for(const side of [result.left, result.right])
		assert.ok(Number.isFinite(side.medianMs) && side.medianMs > 0);
});

/**
 * Keep historical normalization caching exact, bounded and failure-transparent.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { memoizeSourceHistory } from "./helpers/source-history-memo.mjs";
import "./helpers/refinement-history-cache-tests.mjs";
import "./helpers/source-history-digest-tests.mjs";
import "./helpers/history-digest-source-history-tests.mjs";

test("history memoization keys every input and never accepts changed source text", () => {
	const calls = [], original = "authentic\0🙂";
	const normalize = memoizeSourceHistory((path, source, expected) => {
		calls.push([path, source, expected]);
		if(source !== original) throw new Error("Unrecorded source change");
		return JSON.stringify([path, source, expected]);
	});
	for(const [path, expected] of [["a", undefined], ["a", ""], ["a", "old"], ["b", "old"], ["a\0b", "old"]])
	{
		const count = calls.length, first = normalize(path, original, expected);
		assert.equal(normalize(path, original, expected), first);
		assert.equal(calls.length, count + 1);
	}
	for(let attempt = 0; attempt < 2; attempt++)
		assert.throws(() => normalize("a", original + "\n", "old"), /Unrecorded source change/u);
	assert.equal(calls.length, 7);
	assert.equal(normalize("a", original, "old"), JSON.stringify(["a", original, "old"]));
	assert.equal(calls.length, 7);
});

test("history cache replaces old versions and evicts the least recently used entry", () => {
	const calls = [];
	const normalize = memoizeSourceHistory((path, source) => { calls.push([path, source]); return source + "!"; }, { maxEntries: 2 });
	normalize("a", "one"); normalize("b", "two"); normalize("a", "one");
	normalize("c", "three"); normalize("a", "one");
	assert.equal(calls.length, 3);
	normalize("b", "two"); assert.equal(calls.length, 4);
	normalize("b", "changed"); normalize("b", "changed"); assert.equal(calls.length, 5);
	normalize("b", "two"); assert.equal(calls.length, 6);
});

test("history cache bounds bytes independently of entry count and bypasses oversized values", () => {
	let calls = 0;
	const normalize = memoizeSourceHistory((path, source) => { calls++; return source + "!"; }, { maxEntries: 10, maxBytes: 90 });
	normalize("a", "12345"); normalize("a", "12345"); assert.equal(calls, 1);
	normalize("b", "12345"); normalize("c", "12345");
	normalize("a", "12345"); assert.equal(calls, 4);
	for(let attempt = 0; attempt < 2; attempt++) normalize("a", "🙂".repeat(100));
	assert.equal(calls, 6);
	normalize("a", "12345"); assert.equal(calls, 6);
});

test("history cache never retains unchanged or mutable values and can be disabled", () => {
	for(const options of [{ maxEntries: 0 }, { maxBytes: 0 }])
	{
		let calls = 0;
		const normalize = memoizeSourceHistory(() => { calls++; return "prior"; }, options);
		normalize("a", "current"); normalize("a", "current"); assert.equal(calls, 2);
	}
	for(const operation of [(path, source) => source, () => ({ text: "prior" })])
	{
		let calls = 0;
		const normalize = memoizeSourceHistory((...args) => { calls++; return operation(...args); });
		normalize("a", "current"); normalize("a", "current"); assert.equal(calls, 2);
	}
	let calls = 0;
	const normalize = memoizeSourceHistory(() => { calls++; return "prior"; });
	for(const args of [[{}, "current"], ["a", Buffer.from("current")], ["a", "current", null]])
	{
		normalize(...args); normalize(...args);
	}
	assert.equal(calls, 6);
});

test("history cache rejects invalid bounds and preserves original failures", () => {
	assert.throws(() => memoizeSourceHistory(null), TypeError);
	for(const key of ["maxBytes", "maxEntries"])
		for(const value of [-1, 0.5, Infinity, NaN, "2", Number.MAX_SAFE_INTEGER + 1])
			assert.throws(() => memoizeSourceHistory(() => "", { [key]: value }), TypeError);
	const error = new Error("original verification failure"); let calls = 0;
	const normalize = memoizeSourceHistory(() => { calls++; throw error; });
	for(let attempt = 0; attempt < 2; attempt++) assert.throws(() => normalize("a", "b"), candidate => candidate === error);
	assert.equal(calls, 2);
});

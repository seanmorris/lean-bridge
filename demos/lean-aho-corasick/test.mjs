/**
 * Differential tests for the compiled Lean Aho–Corasick matcher.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prepareMatcher, ready, unpackMatches } from "./runtime.mjs";

const encoder = new TextEncoder();
const canonical = matches => matches.map(({ pattern, start, stop }) => `${pattern}:${start}:${stop}`).sort();
const reference = (patterns, input) => {
	const text = typeof input === "string" ? encoder.encode(input) : input;
	const encoded = patterns.map(pattern => typeof pattern === "string" ? encoder.encode(pattern) : pattern);
	const result = [];
	for(let stop = 1; stop <= text.length; stop += 1)
		for(let pattern = 0; pattern < encoded.length; pattern += 1)
		{
			const needle = encoded[pattern];
			if(needle.length > stop) continue;
			const start = stop - needle.length;
			let equal = true;
			for(let offset = 0; offset < needle.length; offset += 1)
				if(needle[offset] !== text[start + offset])
				{ equal = false; break; }
			if(equal) result.push({ pattern, start, stop });
		}
	return result;
};

test("compiled matcher finds the classic overlapping set", async () => {
	const matcher = await prepareMatcher(["he", "she", "his", "hers"]);
	assert.deepEqual(canonical(unpackMatches(matcher.scanBytes("ushers"))), canonical(reference(["he", "she", "his", "hers"], "ushers")));
});

test("duplicates and self-overlaps remain distinct", async () => {
	const patterns = ["a", "aa", "aa"];
	const matcher = await prepareMatcher(patterns);
	assert.deepEqual(canonical(unpackMatches(matcher.scanBytes("aaa"))), canonical(reference(patterns, "aaa")));
});

test("empty input is accepted and empty patterns are rejected", async () => {
	const matcher = await prepareMatcher(["signal"]);
	assert.deepEqual(matcher.scanBytes(new Uint8Array(0)), new Uint32Array(0));
	await assert.rejects(prepareMatcher([""]), /empty patterns/u);
});

test("streaming preserves matches across chunk boundaries", async () => {
	const patterns = ["error", "timeout", "out", "error: timeout"];
	const matcher = await prepareMatcher(patterns);
	const stream = matcher.createStream();
	const streamed = [stream.push("error: ti"), stream.push("me"), stream.push("out")];
	const joined = Uint32Array.from(streamed.flatMap(result => [...result]));
	assert.deepEqual(canonical(unpackMatches(joined)), canonical(reference(patterns, "error: timeout")));
});

test("compiled implementation matches randomized byte references", async () => {
	let state = 0x1132cafe;
	const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
	for(let caseIndex = 0; caseIndex < 80; caseIndex += 1)
	{
		const patterns = Array.from({ length: 1 + Math.floor(random() * 12) }, () => {
			const length = 1 + Math.floor(random() * 7);
			return Uint8Array.from({ length }, () => 97 + Math.floor(random() * 5));
		});
		if(caseIndex % 7 === 0 && patterns.length > 1) patterns[patterns.length - 1] = patterns[0].slice();
		const input = Uint8Array.from({ length: Math.floor(random() * 90) }, () => 97 + Math.floor(random() * 5));
		const matcher = await prepareMatcher(patterns);
		assert.deepEqual(canonical(unpackMatches(matcher.scanBytes(input))), canonical(reference(patterns, input)));
	}
});

test("public API rejects malformed requests", async () => {
	await assert.rejects(prepareMatcher([]), /nonempty array/u);
	await assert.rejects(prepareMatcher([42]), /string or Uint8Array/u);
});

test("disposing a matcher invalidates existing streams and new stream creation", async () => {
	const matcher = await prepareMatcher(["aba"]);
	const stream = matcher.createStream();
	stream.push("ab");
	matcher.dispose(); matcher.dispose();
	assert.throws(() => stream.push("a"), /disposed/u);
	assert.throws(() => matcher.createStream(), /disposed/u);
	assert.throws(() => matcher.scanBytes("aba"), /disposed/u);
});

test("prepared pattern metadata and machine share the same immutable input snapshot", async () => {
	const pattern = Uint8Array.of(97, 98);
	const pending = prepareMatcher([pattern]);
	pattern.fill(120);
	const matcher = await pending;
	try
	{
		assert.deepEqual(matcher.patterns, [Uint8Array.of(97, 98)]);
		assert.deepEqual([...matcher.scanBytes("ab")], [0, 0, 2]);
		matcher.patterns[0].fill(121);
		assert.deepEqual([...matcher.scanBytes("ab")], [0, 0, 2]);
	}
	finally
	{ matcher.dispose(); }
});

test("heap-backed scan bytes survive scratch allocation that grows Wasm memory", async () => {
	const matcher = await prepareMatcher(["nevermatch"]);
	const module = await ready();
	const allocate = module._malloc;
	const pointer = allocate(65_536);
	let padding = 0;
	try
	{
		const input = module.HEAPU8.subarray(pointer, pointer + 65_536);
		input.fill(0);
		const buffer = input.buffer;
		module._malloc = bytes => {
			padding = allocate(module.HEAPU8.byteLength);
			return allocate(bytes);
		};
		assert.equal(matcher.scanBytes(input).length, 0);
		assert.notEqual(module.HEAPU8.buffer, buffer);
	}
	finally
	{
		module._malloc = allocate;
		if(padding) module._free(padding);
		module._free(pointer); matcher.dispose();
	}
});

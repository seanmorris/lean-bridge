/**
 * Differential tests for the compiled Lean Aho–Corasick matcher.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prepareMatcher, unpackMatches } from "./runtime.mjs";

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

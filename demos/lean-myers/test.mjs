/**
 * Exact reconstruction, differential optimality, tokenization, and ownership tests.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prepareDiff, diffTokens, diffTokensTotal, MAX_TOTAL_TOKENS } from "./runtime.mjs";
import { prepareJavascript, solveOracle, verifyResult } from "./reference.mjs";
import { PRESETS, tokenize, prepareTextDiff, textareaValue, reconcileTextareaChange, applyVisibleEdit } from "./scenario.mjs";

const check = async (left, right, diagnostic = false) => {
	const before = Uint32Array.from(left);
	const after = Uint32Array.from(right);
	const oracle = solveOracle(before, after);
	verifyResult(before, after, oracle);
	verifyResult(before, after, prepareJavascript(before, after)(), oracle.distance);
	const result = await (diagnostic ? diffTokensTotal(before, after) : diffTokens(before, after));
	verifyResult(before, after, result, oracle.distance);
	assert.equal(result.usedFallback, diagnostic, "Normal Myers results must certify without the reference");
	return result;
};

const sequences = (alphabet, maximumLength) => {
	const result = [];
	for(let length = 0; length <= maximumLength; length++)
		for(let code = 0; code < alphabet ** length; code++)
			result.push(Uint32Array.from({ length }, (_, index) => Math.floor(code / alphabet ** index) % alphabet));
	return result;
};

test("empty, identical, appended, deleted and replaced sequences return complete shortest scripts", async () => {
	for(const [before, after, distance] of [
		[[], [], 0], [[], [0, 1, 2], 3], [[0, 1, 2], [], 3]
		, [[1, 2, 3], [1, 2, 3], 0], [[1], [2], 2]
		, [[1, 2, 3], [1, 2, 3, 4, 5], 2], [[1, 2, 3, 4, 5], [1, 2, 3], 2]
		, [[0, 1, 2, 3], [0, 4, 2, 3], 2]
	]) assert.equal((await check(before, after)).distance, distance);
});

test("Myers paper example and repeated-token ties preserve global minimum cost", async () => {
	const ids = text => Array.from(text, character => character.codePointAt(0));
	assert.equal((await check(ids("ABCABBA"), ids("CBABAC"))).distance, 5);
	for(const [before, after] of [
		[[1, 2, 1, 2], [2, 1, 2, 1]], [[1, 1, 1, 1], [1, 1]]
		, [[0, 1, 0, 1, 0], [1, 0, 1, 0, 1]], [[1, 2, 3], [3, 2, 1]]
	]) await check(before, after);
});

test("all binary sequences through length six agree with independent dynamic programming", async () => {
	const inputs = sequences(2, 6);
	for(const before of inputs) for(const after of inputs) await check(before, after);
});

test("all ternary sequences through length three agree with independent dynamic programming", async () => {
	const inputs = sequences(3, 3);
	for(const before of inputs) for(const after of inputs) await check(before, after);
});

test("seeded random sequences agree in both directions", async () => {
	let seed = 0x1140face;
	const random = maximum => {
		seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
		return (seed >>> 0) % maximum;
	};
	for(let trial = 0; trial < 180; trial++)
	{
		const before = Uint32Array.from({ length: random(32) }, () => random(7));
		const after = Uint32Array.from({ length: random(32) }, () => random(7));
		assert.equal((await check(before, after)).distance, (await check(after, before)).distance);
	}
});

test("full uint32 IDs, zero IDs, and long common regions remain exact", async () => {
	await check([0, 0xffff_ffff, 0x8000_0000, 0xffff_fffe], [0xffff_ffff, 0x8000_0000, 0, 0xffff_fffe]);
	const before = Uint32Array.from({ length: 1200 }, (_, index) => index % 37);
	const after = before.slice();
	after[600] = 0xffff_ffff;
	assert.equal((await check(before, after)).distance, 2);
	assert.equal((await check(new Uint32Array(MAX_TOTAL_TOKENS), [])).distance, MAX_TOTAL_TOKENS);
	assert.equal((await check([], new Uint32Array(MAX_TOTAL_TOKENS))).distance, MAX_TOTAL_TOKENS);
});

test("total reference independently solves tiny inputs", async () => {
	for(const [before, after] of [[[], []], [[], [1, 2]], [[1, 2], []], [[1], [2]], [[1, 2, 1], [2, 1, 2]]])
		await check(before, after, true);
});

test("maximal edit distance at the 4096-token boundary certifies without fallback", async () => {
	const before = new Uint32Array(MAX_TOTAL_TOKENS / 2);
	const after = new Uint32Array(MAX_TOTAL_TOKENS / 2).fill(1);
	const result = await diffTokens(before, after);
	verifyResult(before, after, result, MAX_TOTAL_TOKENS);
	assert.equal(result.operations.length, MAX_TOTAL_TOKENS);
	assert.equal(result.usedFallback, false);
});

test("hash collisions and reordered equal multisets retain exact optimality", async () => {
	assert.equal((await check([0], [257])).distance, 2);
	assert.equal((await check([0], [257 * 1021])).distance, 2);
	assert.equal((await check([0, 1, 2, 3], [3, 2, 1, 0])).distance, 6);
});

test("prepared solvers snapshot inputs and return independent owned arrays", async () => {
	const before = Uint32Array.of(1, 2, 3);
	const after = Uint32Array.of(1, 4, 3);
	const preparing = prepareDiff({ before, after });
	before.fill(9); after.fill(9);
	const solve = await preparing;
	const other = await prepareDiff({ before, after });
	try
	{
		const first = solve();
		assert.equal(first.distance, 2);
		const originalOperations = first.operations.slice();
		assert.equal(other().distance, 0);
		first.operations.fill(99);
		for(let index = 0; index < 40; index++) assert.deepEqual(solve().operations, originalOperations);
		solve.dispose(); solve.dispose();
		assert.throws(solve, /disposed/u);
		assert.equal(other().distance, 0);
	}
	finally
	{ solve.dispose(); other.dispose(); }
});

test("invalid inputs and excessive diagnostic searches fail before execution", async () => {
	for(const request of [undefined, null, {}, { before: [], after: [] }
		, { before: new Uint32Array(1), after: new Int32Array(1) }
		, { before: new Uint32Array(MAX_TOTAL_TOKENS + 1), after: new Uint32Array() }
	]) await assert.rejects(prepareDiff(request));
	const solve = await prepareDiff({ before: new Uint32Array(13), after: new Uint32Array() });
	try
	{
		assert.throws(() => solve(true), /12 combined tokens/u);
		assert.throws(() => solve("yes"), /boolean/u);
		assert.equal(solve().distance, 13);
	}
	finally
	{ solve.dispose(); }
});

test("independent verifier rejects truncated, incorrect, nonminimal and malformed scripts", () => {
	const before = Uint32Array.of(1);
	const after = Uint32Array.of(2);
	for(const result of [
		{ distance: 0, operations: [0] }
		, { distance: 1, operations: [1] }
		, { distance: 0, operations: [1, 2] }, { distance: -1, operations: [1, 2] }
		, { distance: NaN, operations: [1, 2] }
		, { distance: 2, operations: [1, 2, 2] }
		, { distance: 2, operations: [3] }, { distance: 2, operations: ["1", 2] }
	]) assert.throws(() => verifyResult(before, after, result));
	assert.throws(() => verifyResult(before, before, { distance: 2, operations: [1, 2] }, 0), /minimum/u);
});

test("tokenization preserves every line ending, blank line, Unicode code point and terminal newline", async () => {
	for(const text of ["", "\n", "a\n", "a\n\n", "a\r\nb\rc\n", "🧑🏽‍💻 café é\n", "<script>&x\0"])
		for(const mode of ["lines", "characters"]) assert.equal(tokenize(text, mode).join(""), text);
	assert.deepEqual(tokenize("😀", "characters"), ["😀"]);
	assert.equal(tokenize("é", "characters").length, 2);
	assert.deepEqual(tokenize("a\r\nb\r", "lines"), ["a\r\n", "b\r"]);
	for(const mode of ["lines", "characters"])
	{
		const packed = prepareTextDiff("alpha\r\nbeta\n", "alpha\nbeta", mode);
		assert.equal(packed.beforeTokens.join(""), "alpha\r\nbeta\n");
		assert.equal(packed.afterTokens.join(""), "alpha\nbeta");
		assert.ok((await check(packed.before, packed.after)).distance > 0);
	}
});

test("textarea reconciliation preserves untouched CRLF and exact pasted content", () => {
	const source = "one\r\ntwo\r\nthree";
	assert.equal(textareaValue(source), "one\ntwo\nthree");
	assert.equal(reconcileTextareaChange(source, "one\nTWO\nthree"), "one\r\nTWO\r\nthree");
	assert.equal(applyVisibleEdit(source, 4, 7, "four\r\nfive"), "one\r\nfour\r\nfive\r\nthree");
});

test("all demo presets produce valid minimum scripts in both modes", async () => {
	for(const preset of PRESETS)
		for(const mode of ["lines", "characters"])
		{
			const packed = prepareTextDiff(preset.before, preset.after, mode);
			await check(packed.before, packed.after);
		}
});

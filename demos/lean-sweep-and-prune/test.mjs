/**
 * Differential completeness, closed boundaries, dimensions, and owned FFI output.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prepareSweep, findOverlaps, MAX_BOXES } from "./runtime.mjs";
import { prepareJavascript, solveOracle, verifyResult, pairKeys } from "./reference.mjs";
import { makeWorkload } from "./benchmark-workload.mjs";

const check = async (rows, dimensions = 2, axis = 0) => {
	const request = { boxes: rows instanceof Int32Array ? rows : Int32Array.from(rows.flat()), dimensions, axis };
	const expected = solveOracle(request);
	verifyResult(request, prepareJavascript(request)(), expected);
	const result = await findOverlaps(request);
	verifyResult(request, result, expected);
	return result;
};

test("empty and singleton scenes return no candidates or overlaps", async () => {
	for(const dimensions of [2, 3])
		for(let axis = 0; axis < dimensions; axis++)
		{
			assert.equal((await check([], dimensions, axis)).candidates.length, 0);
			assert.equal((await check(new Int32Array(dimensions * 2), dimensions, axis)).overlaps.length, 0);
		}
});

test("one-axis candidates distinguish actual overlaps from separated boxes", async () => {
	const boxes = [[0, 0, 4, 4], [2, 8, 6, 12], [2, 2, 6, 6], [10, 10, 14, 14]];
	const result = await check(boxes);
	assert.deepEqual(pairKeys(result.candidates, 4), new Set([1, 2, 6]));
	assert.deepEqual(pairKeys(result.overlaps, 4), new Set([2]));
	const otherAxis = await check(boxes, 2, 1);
	assert.deepEqual(pairKeys(otherAxis.overlaps, 4), pairKeys(result.overlaps, 4));
	assert.notDeepEqual(pairKeys(otherAxis.candidates, 4), pairKeys(result.candidates, 4));
});

test("closed touching edges, corners, points, duplicate boxes and zero widths are exact", async () => {
	for(const rows of [
		[[0, 0, 1, 1], [1, 0, 2, 1]], [[0, 0, 1, 1], [1, 1, 2, 2]]
		, [[0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 0, 5], [-1, 2, 1, 2]]
		, [[-2, -2, 2, 2], [-2, -2, 2, 2]], [[-10, -10, 10, 10], [-1, -1, 1, 1]]
	]) for(const axis of [0, 1]) assert.equal((await check(rows, 2, axis)).overlaps.length, 2);
	assert.equal((await check([[0, 0, 1, 1], [2, 0, 3, 1]])).overlaps.length, 0);
});

test("all tiny two-box configurations agree in both axes, including degeneracies", async () => {
	const intervals = [];
	for(let lower = -1; lower <= 1; lower++)
		for(let upper = lower; upper <= 1; upper++) intervals.push([lower, upper]);
	const boxes = intervals.flatMap(x => intervals.map(y => [x[0], y[0], x[1], y[1]]));
	for(const first of boxes) for(const second of boxes)
		for(const axis of [0, 1]) await check([first, second], 2, axis);
});

test("all ordered triples from a tied-start box corpus preserve completeness and uniqueness", async () => {
	const boxes = [[0, 0, 0, 0], [0, 0, 1, 1], [0, 2, 1, 3], [1, 0, 2, 1], [-1, -1, 2, 2], [3, 3, 4, 4]];
	for(const first of boxes) for(const second of boxes) for(const third of boxes)
		for(const axis of [0, 1]) await check([first, second, third], 2, axis);
});

test("3D filtering rejects boxes separated only on the third axis", async () => {
	const rows = [[0, 0, 0, 4, 4, 4], [1, 1, 5, 3, 3, 6], [2, 2, 4, 6, 6, 8], [4, 4, 4, 4, 4, 4]];
	for(const axis of [0, 1, 2]) await check(rows, 3, axis);
	const pair = [rows[0], rows[1]];
	assert.equal((await check(pair, 3, 0)).candidates.length, 2);
	assert.equal((await check(pair, 3, 0)).overlaps.length, 0);
});

test("signed32 endpoints remain exact without overflow or coordinate quantization", async () => {
	const low = -2147483648;
	const high = 2147483647;
	const rows = [[low, low, high, high], [low, 0, low, high], [high, 0, high, high], [-1, -1, 0, 0]];
	for(const axis of [0, 1]) await check(rows, 2, axis);
	for(const axis of [0, 1, 2]) await check([[low, low, low, high, high, high], [0, 0, 0, 0, 0, 0]], 3, axis);
});

test("seeded snapshots and moving scenes agree with quadratic checks in every axis", async () => {
	for(const dimensions of [2, 3])
		for(let seed = 1; seed <= 30; seed++)
		{
			const request = makeWorkload({ count: seed % 29 + 4, dimensions, seed });
			for(let frame = 0; frame < 4; frame++)
			{
				for(let axis = 0; axis < dimensions; axis++) await check(request.boxes, dimensions, axis);
				for(let body = 0; body < request.boxes.length / (dimensions * 2); body++)
					for(let dimension = 0; dimension < dimensions; dimension++)
					{
						const step = (body * 13 + dimension * 7 + frame * 11) % 59 - 29;
						request.boxes[body * dimensions * 2 + dimension] += step;
						request.boxes[body * dimensions * 2 + dimensions + dimension] += step;
					}
			}
		}
});

test("large sparse and dense outputs include every pair exactly once", async () => {
	const sparse = Int32Array.from({ length: MAX_BOXES * 4 }, (_, index) => {
		const body = Math.floor(index / 4);
		return index % 2 ? 0 : body * 3 + (index % 4 === 2 ? 1 : 0);
	});
	assert.equal((await check(sparse)).overlaps.length, 0);
	const dense = makeWorkload({ count: 128, dimensions: 3, dense: true });
	const result = await check(dense.boxes, 3, 2);
	assert.equal(result.candidates.length, 128 * 127);
	assert.equal(result.overlaps.length, result.candidates.length);
	const maximum = await findOverlaps({ boxes: new Int32Array(MAX_BOXES * 4), dimensions: 2 });
	const maximumPairs = MAX_BOXES * (MAX_BOXES - 1) / 2;
	assert.equal(pairKeys(maximum.candidates, MAX_BOXES).size, maximumPairs);
	assert.equal(pairKeys(maximum.overlaps, MAX_BOXES).size, maximumPairs);
});

test("prepared handles snapshot inputs, own outputs, and remain independent after disposal", async () => {
	const boxes = Int32Array.from([0, 0, 2, 2, 1, 1, 3, 3]);
	const request = { boxes, dimensions: 2 };
	const preparing = prepareSweep(request);
	boxes[4] = 10; boxes[6] = 12;
	const solve = await preparing;
	const separated = await prepareSweep(request);
	try
	{
		const first = solve();
		assert.equal(first.overlaps.length, 2);
		assert.equal(separated().overlaps.length, 0);
		first.candidates.fill(99); first.overlaps.fill(99);
		for(let index = 0; index < 40; index++)
		{
			assert.deepEqual(solve().overlaps, Uint32Array.of(0, 1));
			assert.equal(separated().overlaps.length, 0);
		}
		solve.dispose(); solve.dispose();
		assert.throws(solve, /disposed/u);
		assert.equal(separated().candidates.length, 0);
	}
	finally
	{ solve.dispose(); separated.dispose(); }
});

test("malformed shapes, axes, dimensions, box bounds and counts fail before execution", async () => {
	for(const request of [undefined, null, {}, { boxes: [], dimensions: 2 }
		, { boxes: new Uint32Array(4), dimensions: 2 }
		, { boxes: new Int32Array(4), dimensions: 1 }
		, { boxes: new Int32Array(4), dimensions: 2, axis: -1 }
		, { boxes: new Int32Array(4), dimensions: 2, axis: 2 }
		, { boxes: new Int32Array(4), dimensions: 2, axis: .5 }
		, { boxes: new Int32Array(4), dimensions: 2, axis: NaN }
		, { boxes: new Int32Array(3), dimensions: 2 }
		, { boxes: Int32Array.of(3, 0, 2, 1), dimensions: 2 }
		, { boxes: new Int32Array((MAX_BOXES + 1) * 4), dimensions: 2 }
	]) await assert.rejects(prepareSweep(request));
});

test("independent verifier rejects missing, duplicate, reversed and incorrect pairs", () => {
	const request = { boxes: new Int32Array(8), dimensions: 2 };
	for(const candidates of [Uint32Array.of(), Uint32Array.of(0)
		, Uint32Array.of(1, 0), Uint32Array.of(0, 0), Uint32Array.of(0, 2)
		, Uint32Array.of(0, 1, 0, 1), [0, 1]
	]) assert.throws(() => verifyResult(request, { candidates, overlaps: Uint32Array.of(0, 1) }));
	assert.throws(() => verifyResult(request, { candidates: Uint32Array.of(0, 1), overlaps: Uint32Array.of() }));
});

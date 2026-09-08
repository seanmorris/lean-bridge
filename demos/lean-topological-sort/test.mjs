/**
 * Differentially tests the compiled Lean topological-sort API.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prepareSort, sortGraph, sortGraphTotal } from "./runtime.mjs";

const pairs = values => Uint32Array.from(values.flat());
const hasEdge = (edges, source, target) => {
	for(let index = 0; index < edges.length; index += 2)
		if(edges[index] === source && edges[index + 1] === target) return true;
	return false;
};
const verify = ({ vertexCount, edges }, result) => {
	for(const vertex of result.vertices)
		assert.ok(vertex < vertexCount, `result vertex ${vertex} must be below ${vertexCount}`);
	if(result.kind === "order")
	{
		assert.equal(result.vertices.length, vertexCount);
		assert.equal(new Set(result.vertices).size, vertexCount);
		const positions = new Uint32Array(vertexCount);
		result.vertices.forEach((vertex, index) => { positions[vertex] = index; });
		for(let index = 0; index < edges.length; index += 2)
			assert.ok(positions[edges[index]] < positions[edges[index + 1]]);
	}
	else
	{
		assert.ok(result.vertices.length > 0);
		assert.equal(new Set(result.vertices).size, result.vertices.length);
		result.vertices.forEach((source, index) =>
			assert.ok(hasEdge(edges, source, result.vertices[(index + 1) % result.vertices.length])));
	}
};

test("one-shot and prepared topological sorts snapshot before awaiting initialization", async () => {
	const edges = pairs([[0, 1], [1, 2]]);
	const request = { vertexCount: 3, edges };
	const pending = sortGraph(request);
	const preparing = prepareSort(request);
	edges.fill(0);
	const solver = await preparing;
	try
	{
		assert.deepEqual([...(await pending).vertices], [0, 1, 2]);
		assert.deepEqual([...solver().vertices], [0, 1, 2]);
	}
	finally
	{ solver.dispose(); }
});

test("oversized graph allocations are rejected before Wasm32 byte counts can wrap", async () => {
	for(const vertexCount of [0x3fff_ffff, 0x7fff_ffff, 0xffff_fffe])
	{
		const request = { vertexCount, edges: new Uint32Array() };
		await assert.rejects(sortGraph(request), /limit|31-bit/u);
		await assert.rejects(prepareSort(request), /limit|31-bit/u);
	}
});

test("compiled solver orders a build DAG", async () => {
	const request = { vertexCount: 6, edges: pairs([[0, 2], [1, 2], [2, 3], [2, 4], [4, 5]]) };
	const result = await sortGraph(request);
	assert.equal(result.kind, "order");
	verify(request, result);
});

test("compiled solver returns a directed cycle witness", async () => {
	const request = { vertexCount: 5, edges: pairs([[0, 1], [1, 2], [2, 3], [3, 1], [3, 4]]) };
	const result = await sortGraph(request);
	assert.equal(result.kind, "cycle");
	verify(request, result);
});

test("prepared graph is synchronous and repeatable", async () => {
	const request = { vertexCount: 4, edges: pairs([[0, 1], [1, 2], [0, 3]]) };
	const solve = await prepareSort(request);
	try
	{
		verify(request, solve());
		await sortGraph({ vertexCount: 2, edges: pairs([[0, 1]]) });
		verify(request, solve());
	}
	finally
	{
		solve.dispose();
	}
});

test("prepared solvers keep independent immutable graphs and dispose separately", async () => {
	const forward = { vertexCount: 3, edges: pairs([[0, 1], [1, 2]]) };
	const backward = { vertexCount: 3, edges: pairs([[2, 1], [1, 0]]) };
	const larger = { vertexCount: 5, edges: pairs([[0, 1], [1, 2], [2, 0], [3, 4]]) };
	const solvers = await Promise.all([forward, backward, larger].map(prepareSort));
	try
	{
		for(let repeat = 0; repeat < 3; repeat += 1)
		{
			verify(forward, solvers[0]());
			verify(backward, solvers[1]());
			verify(larger, solvers[2]());
		}
		const retained = solvers[0]();
		forward.edges.fill(0);
		assert.deepEqual(solvers[0](), retained);
		solvers[1].dispose();
		solvers[1].dispose();
		assert.throws(solvers[1], /disposed/u);
		assert.deepEqual(solvers[0](), retained);
		verify(larger, solvers[2]());
		solvers[0].dispose();
		assert.deepEqual(retained.vertices, Uint32Array.of(0, 1, 2));
	}
	finally
	{
		for(const solve of solvers) solve.dispose();
	}
});

test("compiled solver covers empty graphs, self loops, and repeated edges", async () => {
	for(const request of [
		{ vertexCount: 0, edges: pairs([]) }
		, { vertexCount: 1, edges: pairs([[0, 0]]) }
		, { vertexCount: 3, edges: pairs([[0, 1], [0, 1], [1, 2]]) }
	]) verify(request, await sortGraph(request));
});

test("compiled solver differentially handles randomized graphs", async () => {
	let state = 0x1131cafe;
	const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
	for(let caseIndex = 0; caseIndex < 100; caseIndex += 1)
	{
		const vertexCount = 1 + Math.floor(random() * 28);
		const edges = [];
		for(let source = 0; source < vertexCount; source += 1)
			for(let target = 0; target < vertexCount; target += 1)
				if(source !== target && random() < .06) edges.push(source, target);
		const request = { vertexCount, edges: Uint32Array.from(edges) };
		verify(request, await sortGraph(request));
	}
});

test("both compiled solvers cover every directed graph through four vertices", async () => {
	for(let vertexCount = 0; vertexCount <= 4; vertexCount += 1)
	{
		const graphCount = 2 ** (vertexCount * vertexCount);
		for(let mask = 0; mask < graphCount; mask += 1)
		{
			const edges = [];
			for(let source = 0; source < vertexCount; source += 1)
				for(let target = 0; target < vertexCount; target += 1)
					if(mask & (1 << (source * vertexCount + target))) edges.push(source, target);
			const request = { vertexCount, edges: Uint32Array.from(edges) };
			const optimized = await sortGraph(request);
			const total = await sortGraphTotal(request);
			verify(request, optimized);
			verify(request, total);
			assert.equal(total.kind, optimized.kind,
				`solvers disagree for ${vertexCount} vertices and adjacency mask ${mask}`);
		}
	}
});

test("constructive solver handles long paths, residual cycles, and repeated edges", async () => {
	for(const vertexCount of [2, 17, 97])
	{
		const chain = Array.from({ length: vertexCount - 1 }, (_, index) => [index, index + 1]);
		for(const edges of [
			pairs(chain)
			, pairs([...chain, ...chain])
			, pairs([...chain, [vertexCount - 1, Math.floor(vertexCount / 2)]])
			, pairs([...chain, [vertexCount - 1, 0]])
		]) {
			const request = { vertexCount, edges };
			verify(request, await sortGraphTotal(request));
		}
	}
});

test("invalid endpoints are rejected before Wasm", async () => {
	await assert.rejects(sortGraph({ vertexCount: 2, edges: Uint32Array.of(0, 2) }), /out-of-range/u);
	await assert.rejects(sortGraphTotal({ vertexCount: 2, edges: Uint32Array.of(0, 2) }), /out-of-range/u);
	await assert.rejects(sortGraphTotal({ vertexCount: 2, edges: Uint32Array.of(0) }), /endpoint pairs/u);
});

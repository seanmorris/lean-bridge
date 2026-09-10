/**
 * A* correctness against Bellman–Ford, exhaustive graphs, and API lifetime checks.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { initRuntime, prepareSearch, solveGraph, solveGraphTotal } from "./runtime.mjs";
import { bellmanFord, prepareJavascriptSearch } from "./reference.mjs";
import { buildSearchRequest, createTerrain, TERRAIN } from "./terrain.mjs";

const graphRequest = (vertexCount, edges, start, target, heuristic = new Uint32Array(vertexCount)) => {
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	const weights = [];
	for(let source = 0; source < vertexCount; source += 1)
	{
		offsets[source] = targets.length;
		for(const [from, to, weight] of edges)
			if(from === source)
			{ targets.push(to); weights.push(weight); }
	}
	offsets[vertexCount] = targets.length;
	return {
		vertexCount
		, offsets
		, targets: Uint32Array.from(targets)
		, weights: Uint32Array.from(weights)
		, heuristic, start, target
	};
};

const checkResult = (request, result) => {
	const expected = bellmanFord(request)[request.target];
	assert.ok(result.path instanceof Uint32Array);
	assert.ok(result.expanded instanceof Uint32Array);
	assert.equal(typeof result.usedFallback, "boolean");
	assert.equal(new Set(result.expanded).size, result.expanded.length, "vertices expand at most once");
	assert.ok(result.expanded.every(vertex => vertex < request.vertexCount));
	if(!Number.isFinite(expected))
	{
		assert.equal(result.kind, "unreachable");
		assert.equal(result.path.length, 0);
		assert.equal(result.cost, 0);
		return;
	}
	assert.equal(result.kind, "path");
	assert.equal(result.cost, expected);
	assert.equal(result.path[0], request.start);
	assert.equal(result.path.at(-1), request.target);
	let cost = 0;
	for(let position = 1; position < result.path.length; position += 1)
	{
		const source = result.path[position - 1];
		const target = result.path[position];
		let edge = request.offsets[source];
		while(edge < request.offsets[source + 1] && request.targets[edge] !== target) edge += 1;
		assert.ok(edge < request.offsets[source + 1], `missing path edge ${source} → ${target}`);
		cost += request.weights[edge];
	}
	assert.equal(cost, result.cost);
};

const checkPaired = async request => {
	const result = await solveGraph(request);
	checkResult(request, result);
	assert.equal(result.usedFallback, false, "the optimized search must certify its ordinary results");
	const javascript = prepareJavascriptSearch(request)();
	assert.deepEqual(result.path, javascript.path);
	assert.deepEqual(result.expanded, javascript.expanded);
	assert.equal(result.cost, javascript.cost);
	return result;
};

test("prepared A* snapshots every graph array before awaiting initialization", async () => {
	const request = graphRequest(3, [[0, 1, 1], [1, 2, 1]], 0, 2);
	const pending = prepareSearch(request);
	request.offsets.fill(0); request.targets.fill(0); request.weights.fill(99); request.heuristic.fill(99);
	const search = await pending;
	try
	{
		assert.deepEqual([...search().path], [0, 1, 2]);
		assert.equal(search().cost, 2);
		assert.throws(() => search("yes"), /boolean/u);
	}
	finally
	{ search.dispose(); }
});

test("large sparse graphs prepare and certify without a stack frame per vertex", async () => {
	const vertexCount = 20000;
	for(const target of [0, vertexCount - 1])
	{
		const request = graphRequest(vertexCount, [], 0, target);
		const search = await prepareSearch(request);
		try
		{
			const expected = prepareJavascriptSearch(request)();
			assert.deepEqual(search(), expected);
			assert.deepEqual(search(), expected, "the prepared sentinel remains valid on repeated runs");
			assert.equal(expected.usedFallback, false);
		}
		finally
		{ search.dispose(); }
	}
});

test("weighted detours, zero-cost cycles, unreachable goals, and singleton paths", async () => {
	await initRuntime();
	const fixtures = [
		graphRequest(5, [[0, 1, 8], [0, 2, 1], [2, 1, 1], [1, 3, 1]], 0, 3)
		, graphRequest(3, [[0, 1, 0], [1, 0, 0], [1, 2, 1]], 0, 2)
		, graphRequest(4, [[0, 1, 1], [2, 3, 1]], 0, 3)
		, graphRequest(1, [], 0, 0)
		, graphRequest(1, [[0, 0, 0]], 0, 0)
		, graphRequest(3, [[0, 0, 0], [0, 1, 4], [1, 1, 0], [1, 2, 2]], 0, 2)
		, graphRequest(2, [[0, 1, 400_000_000]], 0, 1, new Uint32Array([400_000_000, 0]))
	];
	for(const request of fixtures)
	{
		await checkPaired(request);
		checkResult(request, await solveGraphTotal(request));
	}
});

test("stale heap entries are skipped before goal extraction", async () => {
	const request = graphRequest(5, [[0, 1, 9], [0, 2, 1], [2, 1, 1], [1, 3, 20], [3, 4, 1]], 0, 4);
	const result = await checkPaired(request);
	assert.deepEqual([...result.path], [0, 2, 1, 3, 4]);
	assert.deepEqual([...result.expanded], [0, 2, 1, 3, 4]);
});

test("consistent heuristic enables goal-pop early exit and descending-g ties", async () => {
	const request = graphRequest(6, [
		[0, 1, 1], [1, 2, 1], [2, 3, 1], [0, 4, 1], [4, 5, 1], [5, 3, 8]
	], 0, 3, new Uint32Array([3, 2, 1, 0, 2, 1]));
	const guided = await checkPaired(request);
	const unguided = await checkPaired({ ...request, heuristic: new Uint32Array(6) });
	assert.deepEqual([...guided.expanded], [0, 1, 2, 3]);
	assert.ok(guided.expanded.length < unguided.expanded.length);
});

test("all directed three-vertex graphs and endpoint pairs agree with Bellman–Ford", async () => {
	for(let mask = 0; mask < 512; mask += 1)
	{
		const edges = [];
		for(let source = 0; source < 3; source += 1)
			for(let target = 0; target < 3; target += 1)
				if(mask & 1 << (source * 3 + target)) edges.push([source, target, (source + target) % 2]);
		for(let start = 0; start < 3; start += 1)
			for(let target = 0; target < 3; target += 1)
			{
				const request = graphRequest(3, edges, start, target);
				const result = await solveGraph(request);
				checkResult(request, result);
				assert.equal(result.usedFallback, false, `unexpected fallback for graph ${mask}, ${start} → ${target}`);
				checkResult(request, await solveGraphTotal(request));
			}
	}
});

test("random generic weighted graphs agree with Bellman–Ford using consistent nonzero heuristics", async () => {
	let seed = 0x51a7e;
	const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
	for(let trial = 0; trial < 80; trial += 1)
	{
		const count = 2 + random() % 13;
		const target = random() % count;
		const edges = [];
		for(let source = 0; source < count; source += 1)
			for(let next = 0; next < count; next += 1)
				if(random() % 5 === 0) edges.push([source, next, random() % 9]);
		const reverse = graphRequest(count, edges.map(([source, next, weight]) => [next, source, weight]), target, target);
		const toGoal = bellmanFord(reverse);
		const heuristic = Uint32Array.from(toGoal, value => Number.isFinite(value) ? value : count * 9);
		await checkPaired(graphRequest(count, edges, random() % count, target, heuristic));
	}
});

test("prepared searches own their inputs, remain independent, and reject use after disposal", async () => {
	const firstRequest = graphRequest(3, [[0, 1, 2], [1, 2, 3]], 0, 2);
	const secondRequest = graphRequest(2, [[1, 0, 7]], 1, 0);
	const [first, second] = await Promise.all([prepareSearch(firstRequest), prepareSearch(secondRequest)]);
	try
	{
		const expected = first();
		firstRequest.offsets.fill(0); firstRequest.targets.fill(0); firstRequest.weights.fill(0); firstRequest.heuristic.fill(99);
		assert.deepEqual(first(), expected);
		checkResult(secondRequest, second());
		first.dispose(); first.dispose();
		assert.throws(first, /disposed/u);
		checkResult(secondRequest, second());
	}
	finally
	{ first.dispose(); second.dispose(); }
	assert.throws(second, /disposed/u);
});

test("invalid shapes, endpoints, duplicate targets, and inconsistent heuristics are rejected", async () => {
	const valid = graphRequest(2, [[0, 1, 1]], 0, 1);
	const malformed = [
		{ ...valid, vertexCount: 0 }
		, { ...valid, start: -1 }
		, { ...valid, target: 2 }
		, { ...valid, start: 0.5 }
		, { ...valid, offsets: [0, 1, 1] }
		, { ...valid, offsets: new Uint32Array([0, 1]) }
		, { ...valid, offsets: new Uint32Array([1, 1, 1]) }
		, { ...valid, offsets: new Uint32Array([0, 2, 1]) }
		, { ...valid, targets: new Uint32Array([2]) }
		, { ...valid, weights: new Uint32Array() }
		, { ...valid, heuristic: new Uint32Array([2, 0]) }
		, { ...valid, heuristic: new Uint32Array([1, 1]) }
		, { ...valid, heuristic: new Uint32Array([0]) }
		, graphRequest(2, [[0, 1, 1], [0, 1, 2]], 0, 1)
		, graphRequest(2, [[0, 1, 0xffff_ffff]], 0, 1)
	];
	for(const request of malformed) await assert.rejects(prepareSearch(request));
	checkResult(valid, await solveGraph(valid));
});

test("terrain seeds reproduce maps and heuristic strengths preserve the optimal cost", async () => {
	const first = createTerrain("fern", 13, 9);
	assert.deepEqual(createTerrain("fern", 13, 9), first);
	assert.notDeepEqual(createTerrain("river", 13, 9).cells, first.cells);
	for(const seed of ["fern", "river", "ridge"])
	{
		const terrain = createTerrain(seed, 13, 9);
		const costs = [];
		for(const strength of [0, 50, 100])
		{
			const request = buildSearchRequest(terrain, strength);
			assert.equal(request.heuristic[request.target], 0);
			for(let source = 0; source < request.vertexCount; source += 1)
				for(let edge = request.offsets[source]; edge < request.offsets[source + 1]; edge += 1)
					assert.ok(request.heuristic[source] <= request.weights[edge] + request.heuristic[request.targets[edge]]);
			const result = await checkPaired(request);
			assert.equal(result.kind, "path", "generated maps guarantee a floor route");
			costs.push(result.cost);
		}
		assert.equal(new Set(costs).size, 1, "guidance changes search order, not the cheapest route");
	}
});

test("walls remove incoming and outgoing tile edges; erasing a doorway restores the route", async () => {
	const terrain = {
		columns: 7
		, rows: 7
		, cells: new Uint8Array(49).fill(TERRAIN.floor)
		, start: 22
		, target: 26
	};
	for(let row = 0; row < 7; row += 1) terrain.cells[row * 7 + 3] = TERRAIN.wall;
	const blocked = buildSearchRequest(terrain);
	for(let row = 0; row < 7; row += 1)
	{
		const wall = row * 7 + 3;
		assert.equal(blocked.offsets[wall], blocked.offsets[wall + 1]);
		assert.equal(blocked.targets.includes(wall), false);
	}
	assert.equal((await checkPaired(blocked)).kind, "unreachable");
	terrain.cells[24] = TERRAIN.floor;
	const opened = buildSearchRequest(terrain);
	assert.ok(opened.offsets[24] < opened.offsets[25]);
	assert.ok(opened.targets.includes(24));
	const result = await checkPaired(opened);
	assert.deepEqual([...result.path], [22, 23, 24, 25, 26]);
	assert.equal(result.cost, 4);
});

/**
 * Differential and lifecycle tests for the compiled generic flow/cut solver.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prepareGraph, solveGraph, solveGraphTotal } from "./runtime.mjs";
import { fromEdges, solveOracle, prepareJavascript, verifyResult, exhaustiveCutValue } from "./reference.mjs";
import { createNetwork, buildGraphRequest, WIDEN_EDGE_ID, WIDEN_CAPACITY } from "./network.mjs";

const check = async (request, diagnostic = false) => {
	const oracle = solveOracle(request);
	const result = await (diagnostic ? solveGraphTotal(request) : solveGraph(request));
	verifyResult(request, oracle);
	verifyResult(request, result, oracle.value);
	verifyResult(request, prepareJavascript(request)(), oracle.value);
	if(!diagnostic) assert.equal(result.usedFallback, false, "Dinic must certify without reference fallback");
	if(request.vertexCount <= 8) assert.equal(result.value, exhaustiveCutValue(request));
	return result;
};

test("independent verification rejects malformed numerical witnesses", () => {
	const request = fromEdges(3, [[0, 0, 0]]);
	const valid = { value: 0, cutCapacity: 0, flows: [0], sourceSide: [1, 0, 0] };
	assert.equal(verifyResult(request, valid), true);
	for(const flow of [-1, 0.5, NaN, Infinity, "0", undefined])
		assert.throws(() => verifyResult(request, { ...valid, flows: [flow] }), /nonnegative integer/u);
	for(const flag of [-1, 2, 0.5, NaN, "0", undefined])
		assert.throws(() => verifyResult(request, { ...valid, sourceSide: [1, flag, 0] }), /membership/u);
	assert.throws(() => verifyResult(request, { ...valid, cutCapacity: -1 }), /totals/u);
});

test("widening the introductory bottleneck raises flow from 9 to 14 and moves the cut", async () => {
	const network = createNetwork();
	const original = buildGraphRequest(network);
	const first = await check(original.request);
	assert.equal(first.value, 9);
	assert.deepEqual(first.sourceSide, Uint32Array.of(1, 1, 1, 1, 1, 0));
	network.edges.find(edge => edge.id === WIDEN_EDGE_ID).capacity = WIDEN_CAPACITY;
	const changed = buildGraphRequest(network);
	assert.deepEqual(changed.edgeIds, original.edgeIds);
	const second = await check(changed.request);
	assert.equal(second.value, 14);
	assert.deepEqual(second.sourceSide, Uint32Array.of(1, 0, 0, 0, 0, 0));
	network.edges.find(edge => edge.id === WIDEN_EDGE_ID).capacity = 0;
	assert.equal((await check(buildGraphRequest(network).request)).value, 5);
	assert.equal((await check(buildGraphRequest(createNetwork()).request)).value, 9);
});

test("classic directed network returns flow 23 and a matching cut", async () => {
	const request = fromEdges(6, [[0, 1, 16], [0, 2, 13], [1, 2, 10], [2, 1, 4]
		, [1, 3, 12], [2, 4, 14], [3, 2, 9], [4, 3, 7], [3, 5, 20], [4, 5, 4]]);
	assert.equal((await check(request)).value, 23);
});

test("a later blocking phase can cancel earlier flow through a reverse residual arc", async () => {
	const request = fromEdges(6, [[0, 1, 1], [0, 2, 1], [1, 3, 1], [1, 4, 1]
		, [2, 3, 1], [3, 5, 1], [4, 5, 1]]);
	const result = await check(request);
	assert.equal(result.value, 2);
	assert.ok(result.phaseCount >= 2);
	assert.equal(result.flows[2], 0, "the initial A→C choice must be undone to route both units");
});

test("parallel, antiparallel, self-loop, zero, disconnected, and nondefault terminals", async () => {
	for(const request of [
		fromEdges(2, [])
		, fromEdges(2, [[0, 1, 0], [1, 0, 9]])
		, fromEdges(3, [[0, 0, 99], [0, 1, 2], [0, 1, 3], [1, 0, 7], [1, 1, 6], [1, 2, 4], [2, 0, 20]])
		, fromEdges(5, [[4, 3, 7], [3, 1, 6], [4, 1, 2], [1, 4, 50], [0, 2, 9]], 4, 1)
		, fromEdges(4, [[0, 1, 5], [2, 3, 6]])
	]) await check(request);
});

test("full uint32 capacities retain exact flows and totals above one word", async () => {
	const maximum = 0xffff_ffff;
	for(const request of [
		fromEdges(2, [[0, 1, maximum]])
		, fromEdges(2, [[0, 1, maximum], [0, 1, maximum], [1, 0, maximum]])
		, fromEdges(4, [[0, 1, maximum], [0, 2, maximum], [1, 3, maximum], [2, 3, maximum]])
		, fromEdges(3, [[0, 1, 0x8000_0000], [0, 1, maximum], [1, 2, maximum]])
	]) await check(request);
	assert.equal((await check(fromEdges(2, [[0, 1, maximum], [0, 1, maximum]]))).value, 2 * maximum);
});

test("all three-vertex capacity-0/1/2 networks and terminal pairs agree with independent oracles", async () => {
	const pairs = [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]];
	for(let encoding = 0; encoding < 729; encoding++)
	{
		let remainder = encoding;
		const edges = pairs.map(([source, target]) => {
			const capacity = remainder % 3; remainder = Math.floor(remainder / 3);
			return [source, target, capacity];
		});
		for(const [source, sink] of pairs) await check(fromEdges(3, edges, source, sink));
	}
});

test("every four-vertex unit-capacity directed topology agrees with all cuts", async () => {
	const pairs = [];
	for(let source = 0; source < 4; source++)
		for(let target = 0; target < 4; target++) if(source !== target) pairs.push([source, target]);
	for(let mask = 0; mask < 4096; mask++)
		await check(fromEdges(4, pairs.filter((_, index) => mask & 2 ** index).map(pair => [...pair, 1])));
});

test("random directed multigraphs agree with BigInt Edmonds–Karp", async () => {
	let seed = 0x1139abcd;
	const random = maximum => {
		seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
		return (seed >>> 0) % maximum;
	};
	for(let trial = 0; trial < 160; trial++)
	{
		const count = 2 + random(15);
		const edges = Array.from({ length: random(80) }, () => [random(count), random(count), random(32)]);
		const source = random(count);
		const sink = (source + 1 + random(count - 1)) % count;
		await check(fromEdges(count, edges, source, sink));
	}
});

test("proved total reference independently solves small networks", async () => {
	for(const request of [fromEdges(2, []), fromEdges(2, [[0, 1, 3]])
		, fromEdges(3, [[0, 1, 2], [1, 2, 2], [0, 2, 1]])
		, fromEdges(3, [[0, 1, 1], [1, 0, 1], [1, 2, 1], [2, 2, 1]])])
		await check(request, true);
});

test("long chains and wide parallel paths do not recurse on the host stack", async () => {
	const chain = fromEdges(10_000, Array.from({ length: 9999 }, (_, vertex) => [vertex, vertex + 1, 7]));
	assert.equal((await check(chain)).value, 7);
	const edges = [];
	for(let vertex = 1; vertex <= 1000; vertex++) edges.push([0, vertex, 3], [vertex, 1001, 2]);
	assert.equal((await check(fromEdges(1002, edges))).value, 2000);
});

test("explicit exhaustive diagnostics reject excessive search spaces without affecting Dinic", async () => {
	const requests = [fromEdges(13, []), fromEdges(2, [[0, 1, 100_000]])
		, fromEdges(2, Array.from({ length: 25 }, () => [0, 1, 0]))];
	for(const request of requests)
	{
		const solve = await prepareGraph(request);
		try
		{
			assert.throws(() => solve(true), /Exhaustive diagnostics/u);
			assert.throws(() => solve("yes"), /boolean/u);
			verifyResult(request, solve(), solveOracle(request).value);
		}
		finally
		{ solve.dispose(); }
		await assert.rejects(solveGraphTotal(request), /Exhaustive diagnostics/u);
	}
});

test("prepared networks own input snapshots and independent result arrays", async () => {
	const request = fromEdges(3, [[0, 1, 5], [1, 2, 3]]);
	const pending = prepareGraph(request);
	request.offsets.fill(0); request.targets.fill(0); request.capacities.fill(0); request.source = 2;
	const solve = await pending;
	const other = await prepareGraph(fromEdges(2, [[0, 1, 9]]));
	try
	{
		assert.equal(solve().value, 3);
		const first = solve();
		first.flows.fill(0); first.sourceSide.fill(0); first.value = 0;
		assert.equal(solve().value, 3);
		assert.deepEqual(solve().flows, Uint32Array.of(3, 3));
		solve.dispose(); solve.dispose();
		assert.throws(solve, /disposed/u);
		assert.equal(other().value, 9);
	}
	finally
	{ solve.dispose(); other.dispose(); }
	assert.throws(other, /disposed/u);
});

test("invalid graph shapes and terminal IDs are rejected before solving", async () => {
	const valid = () => fromEdges(2, [[0, 1, 5]]);
	for(const value of [-1, 0, 1, 65_537, .5, NaN, Infinity, "2", null])
		await assert.rejects(prepareGraph({ ...valid(), vertexCount: value }));
	for(const field of ["source", "sink"])
		for(const value of [-1, 2, .5, NaN, Infinity, "1", null])
			await assert.rejects(prepareGraph({ ...valid(), [field]: value }));
	await assert.rejects(prepareGraph({ ...valid(), sink: 0 }));
	for(const field of ["offsets", "targets", "capacities"])
		for(const value of [[], new Uint16Array([0, 1]), null])
			await assert.rejects(prepareGraph({ ...valid(), [field]: value }));
	for(const changes of [
		{ offsets: Uint32Array.of(0, 1) }
		, { offsets: Uint32Array.of(1, 1, 1) }
		, { offsets: Uint32Array.of(0, 2, 1) }
		, { offsets: Uint32Array.of(0, 0, 0) }
		, { targets: Uint32Array.of(2) }
		, { capacities: new Uint32Array() }
	]) await assert.rejects(prepareGraph({ ...valid(), ...changes }));
});

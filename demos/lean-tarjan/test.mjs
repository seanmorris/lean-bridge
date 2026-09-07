/**
 * SCC partitions checked independently against Kosaraju, including every graph up to four vertices.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { initRuntime, prepareGraph, solveGraph, solveGraphTotal } from "./runtime.mjs";
import { kosarajuLabels, prepareJavascriptGraph } from "./reference.mjs";
import { buildGraphRequest, collapsedLayout, createPreset, describePartition } from "./graph.mjs";

const graphRequest = (vertexCount, edges) => {
	const rows = Array.from({ length: vertexCount }, () => []);
	for(const [source, target] of edges) rows[source].push(target);
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = new Uint32Array(edges.length);
	let cursor = 0;
	for(let source = 0; source < vertexCount; source += 1)
	{
		offsets[source] = cursor;
		for(const target of rows[source]) targets[cursor++] = target;
	}
	offsets[vertexCount] = cursor;
	return { vertexCount, offsets, targets };
};

const checkResult = (request, result, expected = kosarajuLabels(request)) => {
	assert.ok(result.labels instanceof Uint32Array);
	assert.ok(result.condensation instanceof Uint32Array);
	assert.equal(typeof result.usedFallback, "boolean");
	assert.deepEqual(result.labels, expected);
	const groups = new Map();
	for(let vertex = 0; vertex < request.vertexCount; vertex += 1)
	{
		const root = result.labels[vertex];
		assert.ok(root <= vertex);
		assert.equal(result.labels[root], root);
		if(!groups.has(root)) groups.set(root, []);
		groups.get(root).push(vertex);
	}
	assert.equal(result.componentCount, groups.size);
	assert.deepEqual(result.components, [...groups.values()].map(members => Uint32Array.from(members)));
	const edges = new Set();
	for(let source = 0; source < request.vertexCount; source += 1)
		for(let edge = request.offsets[source]; edge < request.offsets[source + 1]; edge += 1)
		{
			const from = result.labels[source];
			const to = result.labels[request.targets[edge]];
			if(from !== to) edges.add(`${from},${to}`);
		}
	const pairs = [...edges].map(pair => pair.split(",").map(Number))
		.sort(([leftSource, leftTarget], [rightSource, rightTarget]) => leftSource - rightSource || leftTarget - rightTarget);
	assert.deepEqual(result.condensation, Uint32Array.from(pairs.flat()));
	const incoming = new Map([...groups.keys()].map(root => [root, 0]));
	for(const [, target] of pairs) incoming.set(target, incoming.get(target) + 1);
	const queue = [...incoming].filter(([, degree]) => degree === 0).map(([root]) => root);
	for(let head = 0; head < queue.length; head += 1)
		for(const [source, target] of pairs)
			if(source === queue[head])
			{
				const degree = incoming.get(target) - 1;
				incoming.set(target, degree);
				if(degree === 0) queue.push(target);
			}
	assert.equal(queue.length, groups.size, "the returned condensation must be acyclic");
};

test("module feedback merges three components and removal restores the exact partition", async () => {
	const scene = createPreset();
	const original = await solveGraph(buildGraphRequest(scene));
	assert.equal(original.componentCount, 4);
	assert.equal(describePartition(scene, original.labels).groups.filter(group => group.cyclic).length, 3);
	scene.edges.push(scene.feedback);
	const merged = await solveGraph(buildGraphRequest(scene));
	assert.equal(merged.componentCount, 2);
	assert.deepEqual([...merged.labels], [0, 1, 1, 1, 1, 1, 1, 1]);
	scene.edges.pop();
	assert.deepEqual(await solveGraph(buildGraphRequest(scene)), original);
});

test("module adapter preserves stable editor IDs after deletion and distinct group colors", async () => {
	const scene = createPreset("acyclic");
	scene.nodes = scene.nodes.filter(node => node.id !== 2);
	scene.edges = scene.edges.filter(([source, target]) => source !== 2 && target !== 2);
	for(let id = 8; id < 24; id += 1) scene.nodes.push({ id, name: `Module ${id}`, x: .5, y: .5 });
	const result = await solveGraph(buildGraphRequest(scene));
	const partition = describePartition(scene, result.labels);
	assert.equal(partition.groups.length, scene.nodes.length);
	assert.equal(new Set(partition.groups.map(group => group.color)).size, partition.groups.length);
	assert.equal(partition.nodeGroups.has(2), false);
	for(const node of scene.nodes)
		assert.equal(partition.groups[partition.nodeGroups.get(node.id)].nodes[0].id, node.id);
});

test("collapsed layout keeps up to 24 disconnected or ranked cards apart at mobile width", () => {
	for(let count = 0; count <= 24; count += 1)
		for(const shape of ["isolated", "chain", "fan"])
		{
			const groups = Array.from({ length: count }, () => ({}));
			const links = shape === "isolated" ? [] : Array.from({ length: Math.max(0, count - 1) }
				, (_, vertex) => shape === "chain" ? [vertex, vertex + 1] : [0, vertex + 1]);
			const layout = collapsedLayout({ groups, links });
			assert.ok(Number.isFinite(layout.height) && layout.height >= 495);
			for(const [index, point] of layout.positions.entries())
			{
				assert.ok(point.x * 640 >= 69 && point.x * 640 <= 640 - 69);
				assert.ok(point.y * layout.height >= 76 && point.y * layout.height <= layout.height - 76);
				for(const previous of layout.positions.slice(0, index))
					assert.ok(Math.abs(point.x - previous.x) * 640 >= 138
						|| Math.abs(point.y - previous.y) * layout.height >= 152, `${shape} with ${count} groups overlaps`);
			}
		}
});

test("empty, singleton, loops, parallel edges, mixed components, and completed-DFS edges", async () => {
	await initRuntime();
	const fixtures = [
		graphRequest(0, [])
		, graphRequest(1, [])
		, graphRequest(1, [[0, 0], [0, 0]])
		, graphRequest(8, [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 3], [4, 5], [5, 5], [6, 7], [7, 6]])
		, graphRequest(4, [[0, 1], [0, 2], [2, 1], [1, 3], [3, 1]])
		, graphRequest(5, [[0, 1], [0, 1], [1, 0], [1, 2], [1, 2], [2, 3], [3, 2], [4, 4]])
	];
	for(const request of fixtures)
	{
		const result = await solveGraph(request);
		checkResult(request, result);
		assert.equal(result.usedFallback, false);
		checkResult(request, await solveGraphTotal(request));
		checkResult(request, prepareJavascriptGraph(request)());
	}
});

test("all 66,067 directed graphs up to four vertices agree with independent Kosaraju", async () => {
	for(let count = 0; count <= 4; count += 1)
		for(let mask = 0; mask < 2 ** (count * count); mask += 1)
		{
			const edges = [];
			for(let source = 0; source < count; source += 1)
				for(let target = 0; target < count; target += 1)
					if(mask & 1 << (source * count + target)) edges.push([source, target]);
			const request = graphRequest(count, edges);
			const expected = kosarajuLabels(request);
			const result = await solveGraph(request);
			checkResult(request, result, expected);
			assert.equal(result.usedFallback, false, `unexpected fallback for ${count}-vertex graph ${mask}`);
			checkResult(request, await solveGraphTotal(request), expected);
			assert.deepEqual(prepareJavascriptGraph(request)().labels, expected);
		}
});

test("random directed multigraphs agree with Kosaraju without reference fallback", async () => {
	let seed = 0x7a12a9;
	const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
	for(let trial = 0; trial < 120; trial += 1)
	{
		const count = 2 + random() % 47;
		const edges = [];
		for(let source = 0; source < count; source += 1)
			for(let target = 0; target < count; target += 1)
				if(random() % 7 === 0)
				{
					edges.push([source, target]);
					if(random() % 5 === 0) edges.push([source, target]);
				}
		const request = graphRequest(count, edges);
		const result = await solveGraph(request);
		checkResult(request, result);
		assert.equal(result.usedFallback, false);
		assert.deepEqual(prepareJavascriptGraph(request)().labels, result.labels);
	}
});

test("long paths and large cycles use explicit stacks and preserve every vertex", async () => {
	const count = 10_000;
	const edges = Array.from({ length: count - 1 }, (_, vertex) => [vertex, vertex + 1]);
	for(const cyclic of [false, true])
	{
		const request = graphRequest(count, cyclic ? [...edges, [count - 1, 0]] : edges);
		const result = await solveGraph(request);
		assert.equal(result.usedFallback, false);
		assert.deepEqual(result.labels, kosarajuLabels(request));
		assert.deepEqual(result.labels, prepareJavascriptGraph(request)().labels);
		assert.equal(result.componentCount, cyclic ? 1 : count);
		assert.equal(result.condensation.length, cyclic ? 0 : (count - 1) * 2);
		assert.equal(result.components.reduce((sum, members) => sum + members.length, 0), count);
	}
});

test("65,536 isolated vertices complete without recursive checker stack growth", async () => {
	const count = 65_536;
	const request = { vertexCount: count, offsets: new Uint32Array(count + 1), targets: new Uint32Array() };
	const result = await solveGraph(request);
	assert.equal(result.usedFallback, false);
	assert.equal(result.componentCount, count);
	assert.equal(result.labels.length, count);
	assert.ok(result.labels.every((root, vertex) => root === vertex));
	assert.equal(result.components.length, count);
	assert.ok(result.components.every((members, vertex) => members.length === 1 && members[0] === vertex));
	assert.equal(result.condensation.length, 0);
});

test("prepared graphs own snapshots, preserve independent lifetimes, and reject disposed calls", async () => {
	const request = graphRequest(3, [[0, 1], [1, 0], [1, 2]]);
	const original = { ...request, offsets: request.offsets.slice(), targets: request.targets.slice() };
	const secondRequest = graphRequest(2, []);
	const pending = prepareGraph(request);
	request.offsets.fill(0); request.targets.fill(0);
	const [first, second] = await Promise.all([pending, prepareGraph(secondRequest)]);
	try
	{
		const expected = first();
		checkResult(original, expected);
		assert.deepEqual(first(), expected);
		const scratch = first();
		scratch.labels.fill(99); scratch.components[0].fill(99); scratch.condensation.fill(99);
		assert.deepEqual(first(), expected, "returned arrays must not alias later outputs");
		checkResult(secondRequest, second());
		first.dispose(); first.dispose();
		assert.throws(first, /disposed/u);
		checkResult(secondRequest, second());
	}
	finally
	{ first.dispose(); second.dispose(); }
	assert.throws(second, /disposed/u);
});

test("invalid graph shapes and endpoints fail while empty graphs remain valid", async () => {
	const valid = graphRequest(2, [[0, 1]]);
	const malformed = [
		{ ...valid, vertexCount: -1 }
		, { ...valid, vertexCount: 1.5 }
		, { ...valid, vertexCount: Infinity }
		, { ...valid, offsets: [0, 1, 1] }
		, { ...valid, targets: [1] }
		, { ...valid, offsets: new Uint32Array([0, 1]) }
		, { ...valid, offsets: new Uint32Array([1, 1, 1]) }
		, { ...valid, offsets: new Uint32Array([0, 2, 1]) }
		, { ...valid, offsets: new Uint32Array([0, 0, 0]) }
		, { ...valid, targets: new Uint32Array([2]) }
		, { vertexCount: 0, offsets: new Uint32Array([0]), targets: new Uint32Array([0]) }
	];
	for(const request of malformed) await assert.rejects(prepareGraph(request));
	checkResult(valid, await solveGraph(valid));
	const empty = graphRequest(0, []);
	checkResult(empty, await solveGraph(empty));
});

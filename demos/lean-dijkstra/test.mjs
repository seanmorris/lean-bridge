/**
 * Exercises the compiled generic Lean Dijkstra module from Node.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prepareShortestPath, shortestPath } from "./runtime.mjs";

const graph = (vertexCount, edges) => {
	const outgoing = Array.from({ length: vertexCount }, () => []);
	for(const [source, target, weight] of edges) outgoing[source].push([target, weight]);
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	const weights = [];
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		offsets[vertex] = targets.length;
		for(const [target, weight] of outgoing[vertex])
		{
			targets.push(target);
			weights.push(weight);
		}
	}
	offsets[vertexCount] = targets.length;
	return { vertexCount, offsets, targets: Uint32Array.from(targets), weights: Uint32Array.from(weights) };
};

const pathCost = (weighted, path) => {
	let cost = 0;
	for(let index = 1; index < path.length; index += 1)
	{
		const source = path[index - 1];
		const target = path[index];
		let found;
		for(let edge = weighted.offsets[source]; edge < weighted.offsets[source + 1]; edge += 1)
		{
			if(weighted.targets[edge] === target) found = weighted.weights[edge];
		}
		assert.notEqual(found, undefined);
		cost += found;
	}
	return cost;
};

const referenceDistance = (weighted, start, target) => {
	const distances = new Float64Array(weighted.vertexCount).fill(Number.POSITIVE_INFINITY);
	const visited = new Uint8Array(weighted.vertexCount);
	distances[start] = 0;
	for(let step = 0; step < weighted.vertexCount; step += 1)
	{
		let source = -1;
		for(let vertex = 0; vertex < weighted.vertexCount; vertex += 1)
		{
			if(!visited[vertex] && (source < 0 || distances[vertex] < distances[source])) source = vertex;
		}
		if(source < 0 || !Number.isFinite(distances[source])) break;
		if(source === target) return distances[source];
		visited[source] = 1;
		for(let edge = weighted.offsets[source]; edge < weighted.offsets[source + 1]; edge += 1)
		{
			const next = weighted.targets[edge];
			distances[next] = Math.min(distances[next], distances[source] + weighted.weights[edge]);
		}
	}
	return distances[target];
};

test("compiled Lean selects the cheaper weighted route", async () => {
	const weighted = graph(4, [[0, 1, 4], [1, 3, 1], [0, 2, 1], [2, 3, 1]]);
	assert.deepEqual(await shortestPath({ ...weighted, start: 0, target: 3 }), [0, 2, 3]);
});

test("compiled Lean returns an empty path for a disconnected target", async () => {
	const disconnected = graph(3, [[0, 1, 1]]);
	assert.deepEqual(await shortestPath({ ...disconnected, start: 0, target: 2 }), []);
});

test("compiled Lean supports a zero-weight edge", async () => {
	const zeroWeight = graph(2, [[0, 1, 0]]);
	assert.deepEqual(await shortestPath({ ...zeroWeight, start: 0, target: 1 }), [0, 1]);
});

test("prepared Lean graph supports repeated endpoint queries", async () => {
	const weighted = graph(4, [[0, 1, 4], [1, 3, 1], [0, 2, 1], [2, 3, 1]]);
	const solve = await prepareShortestPath(weighted);
	assert.deepEqual(await solve(0, 3), [0, 2, 3]);
	assert.deepEqual(await solve(1, 3), [1, 3]);
});

test("bucketed Lean Dijkstra matches randomized weighted graphs", async () => {
	let state = 0xd1a57a;
	const random = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
	for(let caseIndex = 0; caseIndex < 100; caseIndex += 1)
	{
		const vertexCount = 3 + Math.floor(random() * 22);
		const edges = [];
		for(let source = 0; source < vertexCount; source += 1)
		{
			for(let target = 0; target < vertexCount; target += 1)
			{
				if(source !== target && random() < .16)
				{
					edges.push([source, target, Math.floor(random() * 16)]);
				}
			}
		}
		const weighted = graph(vertexCount, edges);
		const start = Math.floor(random() * vertexCount);
		const target = Math.floor(random() * vertexCount);
		const path = await shortestPath({ ...weighted, start, target });
		const expected = referenceDistance(weighted, start, target);
		if(Number.isFinite(expected))
		{
			assert.equal(path[0], start);
			assert.equal(path.at(-1), target);
			assert.equal(pathCost(weighted, path), expected);
		}
		else assert.deepEqual(path, []);
	}
});

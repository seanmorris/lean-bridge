/**
 * Exercises the compiled generic Lean Dijkstra module from Node.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { shortestPath } from "./runtime.mjs";

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

/**
 * Differential tests for the compiled Lean flood-fill public API.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reachable, reachableWithCapabilities } from "./runtime.mjs";

const referenceReachable = ({ vertexCount, offsets, targets, allowedVertices, allowedEdges, start }) => {
	if(!allowedVertices[start]) return [];
	const visited = new Uint8Array(vertexCount);
	const stack = [start];
	visited[start] = 1;
	while(stack.length)
	{
		const source = stack.pop();
		for(let edge = offsets[source]; edge < offsets[source + 1]; edge += 1)
		{
			const target = targets[edge];
			if(allowedEdges[edge] && allowedVertices[target] && !visited[target])
			{
				visited[target] = 1;
				stack.push(target);
			}
		}
	}
	return [...visited.keys()].filter(vertex => visited[vertex]);
};

const referenceCapabilities = request => {
	const capabilities = new Set(request.initialCapabilities);
	let vertices;
	for(let round = 0; round <= request.capabilityCount; round += 1)
	{
		const allowedEdges = Uint32Array.from(request.requirements,
			requirement => Number(requirement === request.capabilityCount || capabilities.has(requirement)));
		vertices = referenceReachable({ ...request, allowedEdges });
		let changed = false;
		for(const vertex of vertices)
		{
			const grant = request.grants[vertex];
			if(grant < request.capabilityCount && !capabilities.has(grant))
			{
				capabilities.add(grant);
				changed = true;
			}
		}
		if(!changed) return { vertices, capabilities: [...capabilities].sort((a, b) => a - b) };
	}
	throw new Error("reference capability closure did not stabilize");
};

const random = seed => {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
};

const randomGraph = (next, vertexCount, capabilityCount) => {
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	const requirements = [];
	for(let source = 0; source < vertexCount; source += 1)
	{
		for(let target = 0; target < vertexCount; target += 1)
		{
			if(next() < .13)
			{
				targets.push(target);
				requirements.push(next() < .68 ? capabilityCount : Math.floor(next() * capabilityCount));
			}
		}
		offsets[source + 1] = targets.length;
	}
	return {
		vertexCount
		, offsets
		, targets: Uint32Array.from(targets)
		, requirements: Uint32Array.from(requirements)
		, allowedVertices: Uint32Array.from({ length: vertexCount }, () => Number(next() > .15))
		, grants: Uint32Array.from({ length: vertexCount }, () =>
			next() < .22 ? Math.floor(next() * capabilityCount) : capabilityCount)
	};
};

test("compiled flood fill handles directed and disabled edges", async () => {
	const request = {
		vertexCount: 5
		, offsets: Uint32Array.of(0, 2, 3, 4, 5, 5)
		, targets: Uint32Array.of(1, 2, 3, 3, 4)
		, allowedVertices: Uint32Array.of(1, 1, 1, 1, 1)
		, allowedEdges: Uint32Array.of(1, 1, 0, 1, 1)
		, start: 0
	};
	assert.deepEqual([...await reachable(request)], referenceReachable(request));
});

test("compiled capability closure acquires chained reusable keys", async () => {
	const request = {
		vertexCount: 4
		, offsets: Uint32Array.of(0, 1, 2, 3, 3)
		, targets: Uint32Array.of(1, 2, 3)
		, requirements: Uint32Array.of(2, 0, 1)
		, allowedVertices: Uint32Array.of(1, 1, 1, 1)
		, grants: Uint32Array.of(2, 0, 1, 2)
		, initialCapabilities: new Uint32Array()
		, capabilityCount: 2
		, start: 0
	};
	const actual = await reachableWithCapabilities(request);
	const expected = referenceCapabilities(request);
	assert.deepEqual([...actual.vertices], expected.vertices);
	assert.deepEqual([...actual.capabilities].sort((a, b) => a - b), expected.capabilities);
});

test("compiled implementation matches independent randomized references", async () => {
	const next = random(0x51a7c0de);
	for(let caseIndex = 0; caseIndex < 120; caseIndex += 1)
	{
		const capabilityCount = 1 + Math.floor(next() * 5);
		const graph = randomGraph(next, 3 + Math.floor(next() * 18), capabilityCount);
		const start = Math.floor(next() * graph.vertexCount);
		graph.allowedVertices[start] = 1;
		const allowedEdges = Uint32Array.from(graph.requirements, () => Number(next() > .35));
		const floodRequest = { ...graph, allowedEdges, start };
		assert.deepEqual([...await reachable(floodRequest)], referenceReachable(floodRequest));
		const initialCapabilities = Uint32Array.from(
			[...Array(capabilityCount).keys()].filter(() => next() < .2)
		);
		const capabilityRequest = { ...graph, capabilityCount, initialCapabilities, start };
		const actual = await reachableWithCapabilities(capabilityRequest);
		const expected = referenceCapabilities(capabilityRequest);
		assert.deepEqual([...actual.vertices], expected.vertices);
		assert.deepEqual([...actual.capabilities].sort((a, b) => a - b), expected.capabilities);
	}
});

test("public API rejects malformed typed-array requests", async () => {
	await assert.rejects(() => reachable({
		vertexCount: 2
		, offsets: Uint32Array.of(0, 1)
		, targets: Uint32Array.of(1)
		, allowedVertices: Uint32Array.of(1, 1)
		, allowedEdges: Uint32Array.of(1)
		, start: 0
	}), /offsets/u);
});

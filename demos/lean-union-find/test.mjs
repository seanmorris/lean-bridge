/**
 * Differentially tests the compiled Lean union-find API and maze adapter.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	CONNECTED, UNION, partition, partitionDebug, preparePartition, runOperations
} from "./runtime.mjs";
import {
	GRAPH_COUNT, SITE_COUNT, WIDTH, activationOrder, activeFromPrefix, analyzePartition, linksForActive,
	inletDistances, mazeWalls
} from "./percolation.mjs";

const graphComponents = (elementCount, links) => {
	const adjacent = Array.from({ length: elementCount }, () => []);
	for(let index = 0; index < links.length; index += 2)
	{
		const left = links[index];
		const right = links[index + 1];
		adjacent[left].push(right);
		adjacent[right].push(left);
	}
	const labels = new Uint32Array(elementCount);
	labels.fill(0xffff_ffff);
	for(let start = 0; start < elementCount; start += 1)
	{
		if(labels[start] !== 0xffff_ffff) continue;
		const queue = [start];
		labels[start] = start;
		for(let head = 0; head < queue.length; head += 1)
		{
			for(const target of adjacent[queue[head]])
			{
				if(labels[target] === 0xffff_ffff)
				{
					labels[target] = start;
					queue.push(target);
				}
			}
		}
	}
	return labels;
};

const samePartition = (actual, expected) => {
	assert.equal(actual.length, expected.length);
	for(let left = 0; left < actual.length; left += 1)
	{
		for(let right = 0; right < actual.length; right += 1)
		{
			assert.equal(actual[left] === actual[right], expected[left] === expected[right]);
		}
	}
};

const random = seed => {
	let value = seed >>> 0;
	return () => {
		value ^= value << 13;
		value ^= value >>> 17;
		value ^= value << 5;
		return (value >>> 0) / 0x1_0000_0000;
	};
};

test("compiled partition handles chains, cycles, duplicates, and isolated elements", async () => {
	const links = Uint32Array.of(0, 1, 1, 2, 2, 0, 2, 2, 4, 5);
	const result = await partition({ elementCount: 7, links });
	samePartition(result.representatives, graphComponents(7, links));
	const debug = await partitionDebug({ elementCount: 7, links });
	assert.equal(debug.parents.length, 7);
	assert.equal(debug.sizes[debug.representatives[0]], 3);
});

test("prepared partition can be called synchronously and repeatedly", async () => {
	const links = Uint32Array.of(0, 1, 1, 2, 4, 5);
	const solve = await preparePartition({ elementCount: 7, links });
	samePartition(solve().representatives, graphComponents(7, links));
	await partition({ elementCount: 4, links: Uint32Array.of(0, 3) });
	samePartition(solve().representatives, graphComponents(7, links));
	solve.dispose();
});

test("prepared partitions own immutable graphs and independent disposable outputs", async () => {
	const links = Uint32Array.of(0, 1);
	const pending = preparePartition({ elementCount: 3, links });
	links.set([1, 2]);
	const [first, second] = await Promise.all([pending, preparePartition({ elementCount: 3, links })]);
	try
	{
		const retained = first().representatives;
		samePartition(retained, graphComponents(3, Uint32Array.of(0, 1)));
		samePartition(second().representatives, graphComponents(3, Uint32Array.of(1, 2)));
		first().representatives.fill(99);
		assert.deepEqual(first().representatives, retained);
		second.dispose(); second.dispose();
		assert.throws(second, /disposed/u);
		assert.deepEqual(first().representatives, retained);
	}
	finally
	{ first.dispose(); second.dispose(); }
});

test("partition and operation streams snapshot input before asynchronous initialization", async () => {
	const links = Uint32Array.of(0, 1);
	const pending = partition({ elementCount: 3, links });
	links.set([1, 2]);
	samePartition((await pending).representatives, graphComponents(3, Uint32Array.of(0, 1)));
	const operations = Uint32Array.of(UNION, 0, 1, CONNECTED, 0, 1);
	const result = runOperations({ elementCount: 3, operations });
	operations.fill(0);
	assert.deepEqual([...(await result).queries], [1]);
});

test("oversized partitions are rejected before Wasm32 byte counts can wrap", async () => {
	for(const elementCount of [0x4000_0000, 0x7fff_ffff, 0xffff_fffe])
	{
		const request = { elementCount, links: new Uint32Array() };
		await assert.rejects(partition(request), /limit|31-bit/u);
		await assert.rejects(preparePartition(request), /limit|31-bit/u);
	}
});

test("compiled operation stream answers against preceding unions", async () => {
	const operations = Uint32Array.of(
		CONNECTED, 0, 2,
		UNION, 0, 1,
		CONNECTED, 0, 2,
		UNION, 1, 2,
		CONNECTED, 0, 2
	);
	const result = await runOperations({ elementCount: 3, operations });
	assert.deepEqual([...result.queries], [0, 0, 1]);
});

test("compiled implementation matches independent randomized graph traversal", async () => {
	const next = random(0x1130cafe);
	for(let caseIndex = 0; caseIndex < 140; caseIndex += 1)
	{
		const elementCount = Math.floor(next() * 28);
		const links = [];
		const linkCount = elementCount ? Math.floor(next() * elementCount * 3) : 0;
		for(let edge = 0; edge < linkCount; edge += 1)
		{
			links.push(Math.floor(next() * elementCount), Math.floor(next() * elementCount));
		}
		const input = Uint32Array.from(links);
		const result = await partition({ elementCount, links: input });
		samePartition(result.representatives, graphComponents(elementCount, input));
	}
});

test("operation stream matches traversal after every query", async () => {
	const next = random(0x0ddba11);
	for(let caseIndex = 0; caseIndex < 60; caseIndex += 1)
	{
		const elementCount = 2 + Math.floor(next() * 18);
		const links = [];
		const operations = [];
		const expected = [];
		for(let step = 0; step < 70; step += 1)
		{
			const left = Math.floor(next() * elementCount);
			const right = Math.floor(next() * elementCount);
			if(next() < .7)
			{
				operations.push(UNION, left, right);
				links.push(left, right);
			}
			else
			{
				operations.push(CONNECTED, left, right);
				const labels = graphComponents(elementCount, Uint32Array.from(links));
				expected.push(Number(labels[left] === labels[right]));
			}
		}
		const result = await runOperations({ elementCount, operations: Uint32Array.from(operations) });
		assert.deepEqual([...result.queries], expected);
	}
});

test("public API validates malformed requests", async () => {
	await assert.rejects(() => partition({ elementCount: 3, links: Uint32Array.of(0) }), /divisible by 2/u);
	await assert.rejects(() => partition({ elementCount: 3, links: Uint32Array.of(0, 3) }), /out-of-range/u);
	await assert.rejects(() => runOperations({
		elementCount: 3, operations: Uint32Array.of(7, 0, 1)
	}), /unknown opcode/u);
});

test("percolation adapter exposes a spanning component without adding grid rules to Lean", async () => {
	const active = new Uint8Array(SITE_COUNT);
	for(let row = 0; row < SITE_COUNT / WIDTH; row += 1) active[row * WIDTH + 7] = 1;
	const result = await partition({ elementCount: SITE_COUNT, links: linksForActive(active) });
	const analysis = analyzePartition(active, result.representatives);
	assert.equal(analysis.activeCount, 21);
	assert.equal(analysis.componentCount, 1);
	assert.equal(analysis.spanningRoots.size, 1);
});

test("seeded activation orders are deterministic permutations", () => {
	const first = activationOrder(0x1130cafe);
	const second = activationOrder(0x1130cafe);
	assert.deepEqual(first, second);
	assert.equal(new Set(first).size, SITE_COUNT);
	assert.equal(activeFromPrefix(first, 30).reduce((sum, value) => sum + value, 0), 30);
});

test("seeded braided mazes contain permanent walls and a potential crossing", async () => {
	const walls = mazeWalls(0x51ee7a11);
	assert.ok(walls.some(Boolean));
	const order = activationOrder(0x1130cafe, walls);
	assert.ok(order.length < SITE_COUNT);
	assert.ok([...order].every(site => !walls[site]));
	const active = activeFromPrefix(order, order.length);
	const result = await partition({ elementCount: GRAPH_COUNT, links: linksForActive(active, walls, true) });
	assert.equal(analyzePartition(active, result.representatives, walls).spans, true);
	const distances = inletDistances(active, walls);
	assert.ok([...distances].some(distance => distance > 20));
});

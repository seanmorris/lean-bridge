/**
 * Behavioral, randomized differential, and lifetime checks for the compiled LRU.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCache, prepareTrace } from "./runtime.mjs";
import { javascriptTrace, makeWorkload } from "./benchmark-workload.mjs";

test("get promotes a hit; misses preserve order; eviction removes the least recent entry", async () => {
	const cache = await createCache(3);
	try
	{
		cache.put(1, 10); cache.put(2, 20); cache.put(3, 30);
		assert.deepEqual(cache.entries(), [[3, 30], [2, 20], [1, 10]]);
		assert.deepEqual(cache.get(1), { hit: true, value: 10 });
		assert.deepEqual(cache.entries(), [[1, 10], [3, 30], [2, 20]]);
		assert.deepEqual(cache.get(99), { hit: false, value: undefined });
		assert.deepEqual(cache.entries(), [[1, 10], [3, 30], [2, 20]]);
		assert.deepEqual(cache.put(4, 40), { replaced: false, stored: true, evicted: { key: 2, value: 20 } });
		assert.deepEqual(cache.entries(), [[4, 40], [1, 10], [3, 30]]);
		assert.deepEqual(cache.put(1, 11), { replaced: true, stored: true, evicted: null });
		assert.deepEqual(cache.entries(), [[1, 11], [4, 40], [3, 30]]);
	}
	finally
{ cache.dispose(); }
});

test("zero capacity stores nothing, capacity one replaces correctly, and all uint32 values round trip", async () => {
	const zero = await createCache(0);
	const one = await createCache(1);
	try
	{
		assert.deepEqual(zero.put(0, 0), { replaced: false, stored: false, evicted: null });
		assert.deepEqual(zero.get(0), { hit: false, value: undefined });
		assert.deepEqual(zero.entries(), []);
		one.put(0, 0xffff_ffff);
		assert.deepEqual(one.get(0), { hit: true, value: 0xffff_ffff });
		assert.deepEqual(one.put(0xffff_ffff, 0), {
			replaced: false, stored: true, evicted: { key: 0, value: 0xffff_ffff }
		});
		assert.deepEqual(one.entries(), [[0xffff_ffff, 0]]);
		assert.deepEqual(one.get(0xffff_ffff), { hit: true, value: 0 });
	}
	finally
{ zero.dispose(); one.dispose(); }
});

test("randomized mixed get/put traces agree with an independent Map after every operation", async () => {
	let seed = 0x5eed;
	const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
	for(const capacity of [0, 1, 2, 8, 32, 128])
	{
		const cache = await createCache(capacity);
		const reference = new Map();
		try
		{
			for(let index = 0; index < 1000; index += 1)
			{
				const key = random() % 71;
				const value = random();
				const present = reference.has(key);
				if(random() % 3 === 0)
				{
					const stored = reference.get(key);
					assert.deepEqual(cache.get(key), { hit: present, value: stored });
					if(present)
{ reference.delete(key); reference.set(key, stored); }
				}
				else
				{
					let evicted = null;
					if(capacity > 0)
					{
						if(present) reference.delete(key);
						else if(reference.size === capacity)
						{
							const [oldKey, oldValue] = reference.entries().next().value;
							evicted = { key: oldKey, value: oldValue }; reference.delete(oldKey);
						}
						reference.set(key, value);
					}
					assert.deepEqual(cache.put(key, value), { replaced: present, stored: capacity > 0, evicted });
				}
				assert.deepEqual(cache.entries(), [...reference].reverse());
			}
		}
		finally
{ cache.dispose(); }
	}
});

test("batch and individual operations share outcomes and state, including split traces", async () => {
	for(const capacity of [0, 1, 8, 32, 128])
	{
		const input = makeWorkload(capacity, 512);
		const expected = javascriptTrace(capacity, input);
		const prepared = await prepareTrace(capacity, input);
		const cache = await createCache(capacity);
		try
		{
			assert.deepEqual(prepared.run(), expected);
			assert.deepEqual(prepared.run(), expected);
			const split = 127 * 3;
			const first = cache.run(input.slice(0, split));
			const second = cache.run(input.slice(split));
			assert.deepEqual(Uint32Array.from([...first, ...second]), expected);
			const replay = await createCache(capacity);
			try
			{
				for(let i = 0; i < input.length; i += 3)
					if(input[i] === 0) replay.get(input[i + 1]);
					else replay.put(input[i + 1], input[i + 2]);
				assert.deepEqual(cache.entries(), replay.entries());
			}
			finally
{ replay.dispose(); }
		}
		finally
{ prepared.dispose(); cache.dispose(); }
	}
});

test("instances and prepared traces own independent state and reject access after disposal", async () => {
	const [first, second] = await Promise.all([createCache(2), createCache(1)]);
	const input = new Uint32Array([1, 7, 70, 0, 7, 0]);
	const prepared = await prepareTrace(1, input);
	input.fill(0);
	first.put(1, 10); second.put(2, 20);
	assert.deepEqual(first.entries(), [[1, 10]]);
	assert.deepEqual(second.entries(), [[2, 20]]);
	assert.deepEqual(prepared.run(), new Uint32Array([2, 70, 0, 0, 1, 70, 0, 0]));
	first.dispose(); first.dispose();
	assert.throws(() => first.get(1), /disposed/u);
	assert.throws(() => first.put(1, 1), /disposed/u);
	assert.throws(() => first.entries(), /disposed/u);
	assert.throws(() => first.run(new Uint32Array()), /disposed/u);
	assert.deepEqual(second.get(2), { hit: true, value: 20 });
	second.dispose(); prepared.dispose(); prepared.dispose();
	assert.throws(() => prepared.run(), /disposed/u);
});

test("invalid inputs fail before mutation and empty traces preserve cache contents", async () => {
	for(const value of [-1, 1.5, NaN, Infinity, 65_537]) await assert.rejects(createCache(value), /capacity/u);
	const cache = await createCache(2);
	try
	{
		cache.put(1, 10);
		assert.throws(() => cache.get(-1), /key/u);
		assert.throws(() => cache.put(1, 0x1_0000_0000), /value/u);
		assert.throws(() => cache.run([]), /Uint32Array/u);
		assert.throws(() => cache.run(new Uint32Array([1, 2])), /triples/u);
		assert.throws(() => cache.run(new Uint32Array([1, 2, 20, 2, 3, 30])), /kind/u);
		assert.deepEqual(cache.run(new Uint32Array()), new Uint32Array());
		assert.deepEqual(cache.entries(), [[1, 10]]);
		const empty = await prepareTrace(0, new Uint32Array());
		assert.deepEqual(empty.run(), new Uint32Array()); empty.dispose();
	}
	finally
{ cache.dispose(); }
});

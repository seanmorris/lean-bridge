/**
 * Compiled token-bucket behavior checked against independent arbitrary-precision arithmetic.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createBucket, initRuntime, prepareTrace } from "./runtime.mjs";
import { createOracleBucket, createJavascriptBucket, prepareOracleTrace, prepareJavascriptTrace } from "./reference.mjs";
import { makeWorkload } from "./benchmark-workload.mjs";
import { CREDITS_PER_TOKEN, EXAMPLE_CONFIG, EXAMPLE_REQUESTS } from "./scenario.mjs";

const UINT32_MAX = 0xffff_ffff;

const checkTrace = async configuration => {
	const expected = prepareOracleTrace(configuration)();
	const prepared = await prepareTrace(configuration);
	try
	{
		assert.deepEqual(prepared(), expected);
		assert.deepEqual(prepareJavascriptTrace(configuration)(), expected);
	}
	finally
	{ prepared.dispose(); }
	return expected;
};

test("the opening example shows five burst admissions and two exactly timed refills", async () => {
	const configuration = {
		capacity: EXAMPLE_CONFIG.capacity * CREDITS_PER_TOKEN
		, rate: EXAMPLE_CONFIG.rate
		, operations: Uint32Array.from(EXAMPLE_REQUESTS.flatMap(({ timestamp, cost }) => [timestamp, cost * CREDITS_PER_TOKEN]))
	};
	const wire = await checkTrace(configuration);
	const decisions = EXAMPLE_REQUESTS.map((_, event) => wire[event * 7]);
	assert.deepEqual(decisions, [0, 0, 0, 0, 0, 1, 1, 1, 0, 0]);
	for(const event of [5, 6, 7]) assert.equal(wire[event * 7 + 6], 500);
	assert.equal(wire[8 * 7 + 4], CREDITS_PER_TOKEN);
	assert.equal(wire[9 * 7 + 4], CREDITS_PER_TOKEN);
});

test("a five-token bucket admits the burst, waits exactly, and retains partial refill on denial", async () => {
	const configuration = { capacity: 5, rate: 2, now: 10 };
	const bucket = await createBucket(configuration);
	const oracle = createOracleBucket(configuration);
	try
	{
		assert.deepEqual(bucket.snapshot(), { tokens: 5, timestamp: 10 });
		for(const [timestamp, cost] of [[10, 5], [10, 1], [11, 3], [12, 3], [12, 5], [13, 3], [20, 5]])
			assert.deepEqual(bucket.request(timestamp, cost), oracle.request(timestamp, cost));
		assert.deepEqual(bucket.snapshot(), oracle.snapshot());
		assert.deepEqual(bucket.advance(21), oracle.advance(21));
		assert.equal(bucket.snapshot().tokens, 2);
	}
	finally
	{ bucket.dispose(); }
});

test("zero cost, capacity, and refill rate have defined request and retry behavior", async () => {
	for(const configuration of [
		{ capacity: 0, rate: 0 }
		, { capacity: 0, rate: 4 }
		, { capacity: 5, rate: 0 }
		, { capacity: 5, rate: 3 }
	]){
		const result = await checkTrace({ ...configuration, operations: Uint32Array.of(0, 0, 0, 5, 1, 1, 2, 6, 3, 0) });
		assert.equal(result[0], 0);
		assert.equal(result[5], 1);
		assert.equal(result[6], 0);
		assert.equal(result[21], 1);
		assert.equal(result[26], 0, "a request larger than capacity can never become affordable");
	}
});

test("clock regression leaves every state field unchanged and cannot mint credit", async () => {
	const bucket = await createBucket({ capacity: 5, rate: 3, now: 100 });
	try
	{
		bucket.request(100, 5);
		assert.deepEqual(bucket.request(99, 0), {
			status: "clock-regression", allowed: false, tokens: 0, timestamp: 100
			, available: 0, refilled: 0, retryAfter: null
		});
		assert.deepEqual(bucket.snapshot(), { tokens: 0, timestamp: 100 });
		assert.deepEqual(bucket.request(99, UINT32_MAX), bucket.request(0, 0));
		assert.equal(bucket.request(101, 4).status, "throttled");
		assert.deepEqual(bucket.snapshot(), { tokens: 3, timestamp: 101 });
		assert.equal(bucket.request(102, 5).status, "allowed");
	}
	finally
	{ bucket.dispose(); }
});

test("refill and retry boundaries are exact across the full uint32 range", async () => {
	for(const [capacity, rate, operations] of [
		[UINT32_MAX, UINT32_MAX, [0, UINT32_MAX, UINT32_MAX, UINT32_MAX]]
		, [UINT32_MAX, 0x8000_0000, [0, UINT32_MAX, 1, UINT32_MAX, 4, UINT32_MAX]]
		, [UINT32_MAX, 1, [0, UINT32_MAX, 0, UINT32_MAX, UINT32_MAX - 1, UINT32_MAX, UINT32_MAX, UINT32_MAX]]
		, [UINT32_MAX, UINT32_MAX - 1, [0, UINT32_MAX, 0, UINT32_MAX, 1, UINT32_MAX, 2, UINT32_MAX]]
		, [7, 3, [0, 7, 1, 7, 2, 7, 3, 7]]
		, [UINT32_MAX, 0, [0, UINT32_MAX - 1, UINT32_MAX, 2, UINT32_MAX, 1]]
	]) await checkTrace({ capacity, rate, operations: Uint32Array.from(operations) });
	const terminal = await checkTrace({
		capacity: UINT32_MAX, rate: UINT32_MAX, now: UINT32_MAX
		, operations: Uint32Array.of(UINT32_MAX, UINT32_MAX, UINT32_MAX, 1, 0, 0)
	});
	assert.equal(terminal[7 + 6], 1, "retry delay is a duration even at the last representable timestamp");
	assert.equal(terminal[14], 2);
});

test("all tiny two-event traces agree with the BigInt oracle", async () => {
	for(let capacity = 0; capacity <= 3; capacity += 1)
		for(let rate = 0; rate <= 3; rate += 1)
			for(let now = 0; now <= 1; now += 1)
				for(let encoding = 0; encoding < 256; encoding += 1)
				{
					let remainder = encoding;
					const operations = new Uint32Array(4);
					for(let index = 0; index < operations.length; index += 1)
					{ operations[index] = remainder % 4; remainder = Math.floor(remainder / 4); }
					await checkTrace({ capacity, rate, now, operations });
				}
});

test("all tiny three-event traces preserve accumulated state and rejection semantics", async () => {
	for(let capacity = 0; capacity <= 2; capacity += 1)
		for(let rate = 0; rate <= 2; rate += 1)
			for(let encoding = 0; encoding < 729; encoding += 1)
			{
				let remainder = encoding;
				const operations = new Uint32Array(6);
				for(let index = 0; index < operations.length; index += 1)
				{ operations[index] = remainder % 3; remainder = Math.floor(remainder / 3); }
				await checkTrace({ capacity, rate, operations });
			}
});

test("random full-width traces and mixed benchmark traffic match independent exact arithmetic", async () => {
	let seed = 0x1137b00;
	const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
	for(let trial = 0; trial < 160; trial += 1)
	{
		const configuration = { capacity: random(), rate: trial % 4 ? random() : trial % 9, now: random() % 1000 };
		const operations = new Uint32Array(256);
		for(let index = 0; index < operations.length; index += 1) operations[index] = random();
		await checkTrace({ ...configuration, operations });
	}
	await checkTrace(makeWorkload(4096));
});

test("accepted cost never exceeds starting credits plus refill over accepted time", async () => {
	const configuration = makeWorkload(4096);
	const wire = await checkTrace(configuration);
	let spent = 0n;
	for(let event = 0; event < configuration.operations.length / 2; event += 1)
	{
		const offset = event * 7;
		if(wire[offset] === 0) spent += BigInt(configuration.operations[event * 2 + 1]);
		const limit = BigInt(configuration.capacity)
			+ BigInt(wire[offset + 2] - configuration.now) * BigInt(configuration.rate);
		assert.ok(spent <= limit);
		assert.ok(wire[offset + 1] <= configuration.capacity);
	}
});

test("individual requests, chunked runs, and prepared reset-on-run traces agree", async () => {
	const configuration = makeWorkload(1024);
	const expected = prepareOracleTrace(configuration)();
	const bucket = await createBucket(configuration);
	const javascript = createJavascriptBucket(configuration);
	const oracle = createOracleBucket(configuration);
	try
	{
		for(let input = 0; input < 64; input += 2)
		{
			const [timestamp, cost] = configuration.operations.subarray(input, input + 2);
			const result = oracle.request(timestamp, cost);
			assert.deepEqual(bucket.request(timestamp, cost), result);
			assert.deepEqual(javascript.request(timestamp, cost), result);
		}
		assert.deepEqual(bucket.run(configuration.operations.subarray(64)), expected.subarray(32 * 7));
		assert.deepEqual(bucket.snapshot(), { tokens: expected.at(-6), timestamp: expected.at(-5) });
		const before = bucket.snapshot();
		assert.deepEqual(bucket.run(new Uint32Array()), new Uint32Array());
		assert.deepEqual(bucket.snapshot(), before);
	}
	finally
	{ bucket.dispose(); }
	await checkTrace({ capacity: 0, rate: 0, operations: new Uint32Array() });
});

test("heap-backed input is snapshotted before scratch allocation grows Wasm memory", async () => {
	const module = await initRuntime();
	const bucket = await createBucket({ capacity: 5, rate: 2 });
	let pointer = 0;
	try
	{
		pointer = module._malloc(8_000_000);
		assert.ok(pointer);
		const buffer = module.HEAPU32.buffer;
		const operations = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + 2_000_000);
		operations.fill(0);
		const wire = bucket.run(operations);
		assert.notEqual(module.HEAPU32.buffer, buffer, "this case must exercise actual memory growth");
		assert.equal(wire.length, 7_000_000);
		assert.deepEqual(wire.slice(0, 7), Uint32Array.of(0, 5, 0, 5, 0, 1, 0));
		assert.deepEqual(wire.slice(-7), Uint32Array.of(0, 5, 0, 5, 0, 1, 0));
		assert.deepEqual(bucket.snapshot(), { tokens: 5, timestamp: 0 });
	}
	finally
	{ if(pointer) module._free(pointer); bucket.dispose(); }
});

test("large traces complete without recursive stack growth or truncated records", async () => {
	const configuration = makeWorkload(100_000);
	const wire = await checkTrace(configuration);
	assert.equal(wire.length, 700_000);
	assert.ok(wire[wire.length - 5] >= configuration.now);
});

test("prepared traces snapshot input, reset on every run, and own independent outputs", async () => {
	const configuration = makeWorkload(16);
	const original = { ...configuration, operations: configuration.operations.slice() };
	const pending = prepareTrace(configuration);
	configuration.operations.fill(0);
	configuration.capacity = 0;
	const prepared = await pending;
	const second = await prepareTrace({ capacity: 1, rate: 0, operations: Uint32Array.of(0, 1, 0, 1) });
	try
	{
		const expected = prepareOracleTrace(original)();
		assert.deepEqual(prepared(), expected);
		prepared().fill(UINT32_MAX);
		assert.deepEqual(prepared(), expected);
		prepared.dispose(); prepared.dispose();
		assert.throws(prepared, /disposed/u);
		assert.deepEqual(second(), Uint32Array.of(0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0));
	}
	finally
	{ prepared.dispose(); second.dispose(); }
	assert.throws(second, /disposed/u);
});

test("bucket handles remain independent and disposal rejects further operations", async () => {
	const first = await createBucket({ capacity: 5, rate: 1 });
	const second = await createBucket({ capacity: 7, rate: 0, now: 2 });
	try
	{
		first.request(0, 5);
		const snapshot = second.snapshot();
		snapshot.tokens = 0; snapshot.timestamp = 0;
		assert.deepEqual(second.snapshot(), { tokens: 7, timestamp: 2 });
		first.dispose(); first.dispose();
		for(const operation of [() => first.request(0, 0), () => first.advance(0), () => first.snapshot(), () => first.run(new Uint32Array())])
			assert.throws(operation, /disposed/u);
		assert.equal(second.request(2, 7).allowed, true);
	}
	finally
	{ first.dispose(); second.dispose(); }
});

test("maximum-length traces preserve existing handles and outputs across heap growth", async () => {
	const module = await initRuntime();
	const bucket = await createBucket({ capacity: UINT32_MAX, rate: UINT32_MAX });
	const prepared = await prepareTrace(makeWorkload(16));
	let large;
	try
	{
		const expected = prepared();
		const previousBytes = module.HEAPU32.byteLength;
		large = await prepareTrace(makeWorkload(1_000_000));
		const wire = large();
		assert.equal(wire.length, 7_000_000);
		assert.ok(module.HEAPU32.byteLength >= previousBytes);
		assert.deepEqual(prepared(), expected);
		assert.deepEqual(bucket.snapshot(), { tokens: UINT32_MAX, timestamp: 0 });
		assert.equal(bucket.request(0, UINT32_MAX).allowed, true);
		assert.equal(bucket.request(UINT32_MAX, UINT32_MAX).allowed, true);
	}
	finally
	{ large?.dispose(); prepared.dispose(); bucket.dispose(); }
});

test("invalid configuration, timestamps, costs, and trace shapes are rejected without changing state", async () => {
	const invalid = [-1, .5, NaN, Infinity, UINT32_MAX + 1, "1", null, 1n];
	for(const value of invalid)
		for(const field of ["capacity", "rate", "now"])
			await assert.rejects(createBucket({ capacity: 5, rate: 2, now: 0, [field]: value }));
	for(const operations of [[0, 1], new Uint16Array([0, 1]), Uint32Array.of(0)])
		await assert.rejects(prepareTrace({ capacity: 5, rate: 2, operations }));
	await assert.rejects(prepareTrace({ capacity: 5, rate: 2, operations: new Uint32Array(2_000_002) }));
	const bucket = await createBucket({ capacity: 5, rate: 2 });
	try
	{
		for(const value of invalid)
		{
			assert.throws(() => bucket.request(value, 1));
			assert.throws(() => bucket.request(0, value));
			assert.throws(() => bucket.advance(value));
		}
		for(const operations of [[0, 1], new Uint16Array([0, 1]), Uint32Array.of(0)])
			assert.throws(() => bucket.run(operations));
		assert.deepEqual(bucket.snapshot(), { tokens: 5, timestamp: 0 });
		assert.equal(bucket.request(0, 5).allowed, true);
	}
	finally
	{ bucket.dispose(); }
});

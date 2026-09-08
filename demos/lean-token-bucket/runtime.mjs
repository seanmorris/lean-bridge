/**
 * Stateful generic credit/tick API for the compiled Lean token bucket.
 *
 * @file
 */

import createModule from "./runtime/lean-token-bucket.mjs";

const MAX_UINT32 = 0xffff_ffff;
const MAX_OPERATIONS = 1_000_000;
const RECORD_WORDS = 7;
let modulePromise;

/** Initialize the compiled Lean runtime once for all independent buckets. */
export const initRuntime = () => {
	const pending = modulePromise ??= createModule({
		locateFile: path => path === "lean-token-bucket.wasm"
			? new URL("./runtime/lean-token-bucket.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_token_bucket_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

const unsigned = (value, name) => {
	if(!Number.isInteger(value) || value < 0 || value > MAX_UINT32)
		throw new RangeError(`${name} must be an unsigned 32-bit integer`);
	return value;
};
const configChecked = ({ capacity, rate, now = 0 }) => ({
	capacity: unsigned(capacity, "capacity")
	, rate: unsigned(rate, "rate")
	, now: unsigned(now, "now")
});
const operationsChecked = operations => {
	if(!(operations instanceof Uint32Array)) throw new TypeError("operations must be a Uint32Array");
	if(operations.length % 2 || operations.length / 2 > MAX_OPERATIONS)
		throw new RangeError("operations must contain at most 1,000,000 [timestamp, cost] pairs");
	return operations;
};
const allocate = (module, bytes) => {
	const pointer = module._malloc(Math.max(16, bytes));
	if(!pointer) throw new Error(`Unable to allocate ${bytes} Wasm bytes`);
	return pointer;
};
const copyOutput = (module, pointer, words) => module.HEAPU32.slice(pointer >>> 2, (pointer >>> 2) + words);
const parse = (module, pointer) => {
	const wire = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + RECORD_WORDS);
	if(wire[0] > 2 || wire[5] > 1) throw new Error("Invalid Lean token-bucket result");
	return {
		status: ["allowed", "throttled", "clock-regression"][wire[0]]
		, allowed: wire[0] === 0
		, tokens: wire[1], timestamp: wire[2], available: wire[3], refilled: wire[4]
		, retryAfter: wire[5] ? wire[6] : null
	};
};

/**
 * Create an independent bucket, initially full, in generic integer credits/ticks.
 *
 * @param configuration Capacity, refill rate per tick, and optional initial timestamp.
 * @returns {Promise<object>} Synchronous request, advance, snapshot, run, and dispose methods.
 */
export const createBucket = async configuration => {
	const { capacity, rate, now } = configChecked(configuration);
	const module = await initRuntime();
	let pointer = allocate(module, RECORD_WORDS * 4);
	let id = module._lean_token_bucket_create(capacity, rate, now) >>> 0;
	if(!id)
	{ module._free(pointer); throw new Error("Unable to create Lean token bucket"); }
	const live = () => { if(!id) throw new Error("Token bucket has been disposed"); };
	const request = (timestamp, cost) => {
		live(); unsigned(timestamp, "timestamp"); unsigned(cost, "cost");
		if(module._lean_token_bucket_request_c(id, timestamp, cost, pointer, RECORD_WORDS) !== RECORD_WORDS)
			throw new Error("Invalid Lean request result length");
		return parse(module, pointer);
	};
	const snapshot = () => {
		live();
		if(module._lean_token_bucket_snapshot_c(id, pointer, RECORD_WORDS) !== 2)
			throw new Error("Invalid Lean snapshot length");
		const offset = pointer >>> 2;
		return { tokens: module.HEAPU32[offset], timestamp: module.HEAPU32[offset + 1] };
	};
	const run = operations => {
		live(); operationsChecked(operations);
		// A scratch allocation can detach a caller's view into this Wasm heap.
		const input = operations.buffer === module.HEAPU32.buffer ? operations.slice() : operations;
		const words = input.length / 2 * RECORD_WORDS;
		const scratch = allocate(module, Math.max(input.byteLength, words * 4));
		try
		{
			module.HEAPU32.set(input, scratch >>> 2);
			const length = module._lean_token_bucket_run_c(id, scratch, input.length, scratch, words) >>> 0;
			if(length !== words) throw new Error("Invalid Lean trace result length");
			return copyOutput(module, scratch, words);
		}
		finally
		{ module._free(scratch); }
	};
	const dispose = () => {
		if(!id) return;
		module._lean_token_bucket_release(id);
		module._free(pointer);
		id = 0; pointer = 0;
	};
	return { request, advance: timestamp => request(timestamp, 0), snapshot, run, dispose };
};

/**
 * Snapshot a trace for repeated independent runs from a full initial bucket.
 *
 * @param configuration Capacity, rate, optional initial time, and timestamp/cost pairs.
 * @returns {Promise<(() => Uint32Array) & {dispose: () => void}>} Repeatable trace with disposal.
 */
export const prepareTrace = async configuration => {
	const { capacity, rate, now } = configChecked(configuration);
	const input = operationsChecked(configuration.operations).slice();
	const module = await initRuntime();
	const words = input.length / 2 * RECORD_WORDS;
	let pointer = allocate(module, Math.max(input.byteLength, words * 4));
	module.HEAPU32.set(input, pointer >>> 2);
	const id = module._lean_token_bucket_prepare_trace(capacity, rate, now, pointer, input.length) >>> 0;
	if(!id)
	{ module._free(pointer); throw new Error("Unable to prepare Lean token-bucket trace"); }
	const run = () => {
		if(!pointer) throw new Error("Token-bucket trace has been disposed");
		const length = module._lean_token_bucket_repeat_trace(id, pointer, words) >>> 0;
		if(length !== words) throw new Error("Invalid Lean prepared trace result length");
		return copyOutput(module, pointer, words);
	};
	run.dispose = () => {
		if(!pointer) return;
		module._lean_token_bucket_release_trace(id);
		module._free(pointer); pointer = 0;
	};
	return run;
};

/**
 * Stateful JavaScript API for the compiled, proven Lean LRU cache.
 *
 * @file
 */

import createLeanModule from "./runtime/lean-lru-cache.mjs";

const MAX_CAPACITY = 65_536;
const MAX_OPERATIONS = 1_000_000;
let modulePromise;

/** Initialize the generated module once for all independent cache handles. */
const loadModule = () => {
	const pending = modulePromise ??= createLeanModule({
		locateFile: path => path === "lean-lru-cache.wasm"
			? new URL("./runtime/lean-lru-cache.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_lru_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

const unsigned = (value, label, maximum = 0xffff_ffff) => {
	if(!Number.isInteger(value) || value < 0 || value > maximum)
		throw new RangeError(`${label} must be an integer from 0 through ${maximum}`);
	return value;
};

const operationsChecked = operations => {
	if(!(operations instanceof Uint32Array)) throw new TypeError("operations must be a Uint32Array");
	if(operations.length % 3 || operations.length / 3 > MAX_OPERATIONS)
		throw new RangeError("operations must contain at most 1,000,000 [kind, key, value] triples");
	for(let index = 0; index < operations.length; index += 3)
		if(operations[index] > 1) throw new RangeError("operation kind must be 0 (get) or 1 (put)");
	return operations;
};

const allocate = (module, bytes) => {
	const pointer = module._malloc(Math.max(bytes, 16));
	if(!pointer) throw new Error(`Unable to allocate ${bytes} Wasm bytes`);
	return pointer;
};

const copyOutput = (module, pointer, words) => Uint32Array.from(
	module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + words));

/**
 * Create an independent cache with unsigned 32-bit keys and values.
 *
 * @param {number} capacity Maximum entries, including zero to disable storage.
 * @returns {Promise<object>} Synchronous get, put, entries, run, and dispose methods.
 */
export const createCache = async capacity => {
	unsigned(capacity, "capacity", MAX_CAPACITY);
	const module = await loadModule();
	let pointer = allocate(module, Math.max(4, capacity * 2) * 4);
	let id = module._lean_lru_create(capacity) >>> 0;
	if(!id)
	{ module._free(pointer); throw new Error("Unable to create Lean cache"); }
	const live = () => { if(!id) throw new Error("Cache has been disposed"); };
	const get = key => {
		live(); unsigned(key, "key");
		if(module._lean_lru_access(id, 0, key, 0, pointer) !== 4) throw new Error("Invalid Lean get result");
		const offset = pointer >>> 2;
		const hit = module.HEAPU32[offset] === 1;
		return { hit, value: hit ? module.HEAPU32[offset + 1] : undefined };
	};
	const put = (key, value) => {
		live(); unsigned(key, "key"); unsigned(value, "value");
		if(module._lean_lru_access(id, 1, key, value, pointer) !== 4) throw new Error("Invalid Lean put result");
		const offset = pointer >>> 2;
		const status = module.HEAPU32[offset];
		return {
			replaced: status === 3
			, stored: status !== 5
			, evicted: status === 4 ? { key: module.HEAPU32[offset + 2], value: module.HEAPU32[offset + 3] } : null
		};
	};
	const entries = () => {
		live();
		const length = module._lean_lru_entries(id, pointer) >>> 0;
		if(length > capacity * 2 || length % 2) throw new Error("Invalid Lean snapshot");
		const result = [];
		const offset = pointer >>> 2;
		for(let index = 0; index < length; index += 2)
			result.push([module.HEAPU32[offset + index], module.HEAPU32[offset + index + 1]]);
		return result;
	};
	const run = operations => {
		live(); operationsChecked(operations);
		const input = operations.buffer === module.HEAPU32.buffer ? operations.slice() : operations;
		const words = input.length / 3 * 4;
		const scratch = allocate(module, Math.max(input.byteLength, words * 4));
		try
		{
			module.HEAPU32.set(input, scratch >>> 2);
			const output = scratch;
			const length = module._lean_lru_trace(id, scratch, input.length, output) >>> 0;
			if(length !== words) throw new Error("Invalid Lean trace result");
			return copyOutput(module, output, length);
		}
		finally
		{ module._free(scratch); }
	};
	const dispose = () => {
		if(!id) return;
		module._lean_lru_destroy(id); module._free(pointer);
		id = 0; pointer = 0;
	};
	return { capacity, get, put, entries, run, dispose };
};

/**
 * Prepare an immutable operation trace for repeated independent runs from an empty cache.
 *
 * @param {number} capacity Maximum cache entries.
 * @param {Uint32Array} operations Input triples: 0/get or 1/put, key, value.
 * @returns {Promise<object>} A synchronous run returning outcome quads, plus dispose.
 */
export const prepareTrace = async (capacity, operations) => {
	unsigned(capacity, "capacity", MAX_CAPACITY);
	const input = operationsChecked(operations).slice();
	const module = await loadModule();
	const words = input.length / 3 * 4;
	let pointer = allocate(module, Math.max(input.byteLength, words * 4));
	module.HEAPU32.set(input, pointer >>> 2);
	const id = module._lean_lru_prepare_trace(capacity, pointer, input.length) >>> 0;
	if(!id)
	{
		module._free(pointer);
		throw new Error("Unable to prepare Lean operation trace");
	}
	const output = pointer;
	const run = () => {
		if(!pointer) throw new Error("Trace has been disposed");
		const length = module._lean_lru_repeat_trace(id, output) >>> 0;
		if(length !== words) throw new Error("Invalid Lean trace result");
		return copyOutput(module, output, words);
	};
	const dispose = () => {
		if(!pointer) return;
		module._lean_lru_destroy_trace(id);
		module._free(pointer); pointer = 0;
	};
	return { run, dispose };
};

/** Resolve when the shared Lean runtime has initialized. */
export const ready = loadModule;

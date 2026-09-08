/**
 * Owned generic token-sequence handles for the compiled Lean shortest-edit solver.
 *
 * @file
 */

import createModule from "./runtime/lean-myers.mjs";

export const MAX_TOTAL_TOKENS = 4096;
const HEADER_WORDS = 6;
let modulePromise;

/** Initialize the shared Lean/Wasm module once. */
export const initRuntime = () => {
	const pending = modulePromise ??= createModule({ locateFile: path => path === "lean-myers.wasm"
		? new URL("./runtime/lean-myers.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_myers_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

/**
 * Snapshot generic uint32 token sequences and prepare an independently owned solver.
 *
 * @param {object} request Before and after Uint32Array token sequences.
 * @returns {Promise<((diagnostic?: boolean) => object) & {dispose: () => void}>} Synchronous solver with disposal.
 */
export const prepareDiff = async request => {
	if(!request || !(request.before instanceof Uint32Array) || !(request.after instanceof Uint32Array))
		throw new TypeError("before and after must be Uint32Array token sequences");
	if(request.before.length + request.after.length > MAX_TOTAL_TOKENS)
		throw new RangeError(`At most ${MAX_TOTAL_TOKENS.toLocaleString("en-US")} combined tokens are supported`);
	const before = request.before.slice();
	const after = request.after.slice();
	const total = before.length + after.length;
	if(total > MAX_TOTAL_TOKENS)
		throw new RangeError(`At most ${MAX_TOTAL_TOKENS.toLocaleString("en-US")} combined tokens are supported`);
	const module = await initRuntime();
	const input = module._malloc(Math.max(4, total * 4));
	if(!input) throw new Error("Unable to allocate edit-script input");
	let handle;
	try
	{
		module.HEAPU32.set(before, input >>> 2);
		module.HEAPU32.set(after, (input >>> 2) + before.length);
		handle = module._lean_myers_prepare_c(input, before.length, input + before.byteLength, after.length) >>> 0;
	}
	finally
	{ module._free(input); }
	if(!handle) throw new Error("Lean could not prepare the token sequences");
	const capacity = HEADER_WORDS + total;
	const pointer = module._malloc(capacity * 4);
	if(!pointer)
	{
		module._lean_myers_release(handle);
		throw new Error("Unable to allocate edit-script output");
	}
	let disposed = false;
	const solve = (diagnostic = false) => {
		if(disposed) throw new Error("Prepared edit sequences have been disposed");
		if(typeof diagnostic !== "boolean") throw new TypeError("diagnostic must be a boolean");
		if(diagnostic && total > 12)
			throw new RangeError("Exhaustive diagnostics require at most 12 combined tokens");
		const length = module._lean_myers_run(handle, diagnostic ? 1 : 0, pointer, capacity) >>> 0;
		if(length < HEADER_WORDS || length > capacity) throw new Error("Invalid Lean edit-script result length");
		const wire = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + length);
		if(wire[0] !== 0 || wire[1] > total || wire[2] !== before.length || wire[3] !== after.length
			|| wire[4] !== length - HEADER_WORDS || wire[5] > 1)
			throw new Error("Invalid Lean edit-script result header");
		return { distance: wire[1], operations: wire.slice(HEADER_WORDS), usedFallback: wire[5] === 1 };
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_myers_release(handle);
		module._free(pointer);
	};
	return solve;
};

/**
 * Compute a shortest edit script and release temporary prepared storage.
 *
 * @param {Uint32Array} before Original sequence.
 * @param {Uint32Array} after Target sequence.
 */
export const diffTokens = async (before, after) => {
	const solve = await prepareDiff({ before, after });
	try
	{ return solve(); }
	finally
	{ solve.dispose(); }
};

/**
 * Exercise the proved reference on tiny token sequences.
 *
 * @param {Uint32Array} before Original sequence.
 * @param {Uint32Array} after Target sequence.
 */
export const diffTokensTotal = async (before, after) => {
	const solve = await prepareDiff({ before, after });
	try
	{ return solve(true); }
	finally
	{ solve.dispose(); }
};

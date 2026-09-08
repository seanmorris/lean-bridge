/**
 * Owned signed-integer AABB snapshots for compiled Lean sweep and prune.
 *
 * @file
 */

import createModule from "./runtime/lean-sweep-and-prune.mjs";

export const MAX_BOXES = 1024;
const HEADER_WORDS = 6;
let modulePromise;

/** Initialize the shared Lean/Wasm runtime once. */
export const initRuntime = () => {
	const pending = modulePromise ??= createModule({ locateFile: path => path === "lean-sweep-and-prune.wasm"
		? new URL("./runtime/lean-sweep-and-prune.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_sweep_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

/**
 * Snapshot boxes before awaiting; each call sorts and sweeps the complete snapshot.
 *
 * @param {object} request Packed Int32Array boxes, dimensions (2 or 3), and optional axis.
 * @returns {Promise<(() => object) & {dispose: () => void}>} Owned reusable solver.
 */
export const prepareSweep = async request => {
	if(!request || !(request.boxes instanceof Int32Array))
		throw new TypeError("boxes must be an Int32Array of lower coordinates followed by upper coordinates");
	const { dimensions, axis = 0 } = request;
	if(dimensions !== 2 && dimensions !== 3) throw new RangeError("dimensions must be 2 or 3");
	if(!Number.isInteger(axis) || axis < 0 || axis >= dimensions)
		throw new RangeError("axis must name one of the box dimensions");
	const stride = dimensions * 2;
	if(request.boxes.length % stride) throw new RangeError("Each box must contain one lower and upper coordinate per axis");
	if(request.boxes.length / stride > MAX_BOXES) throw new RangeError(`At most ${MAX_BOXES} boxes are supported`);
	const boxes = request.boxes.slice();
	const count = boxes.length / stride;
	if(!Number.isInteger(count) || count > MAX_BOXES) throw new RangeError("Invalid box snapshot length");
	for(let index = 0; index < boxes.length; index += stride)
		for(let dimension = 0; dimension < dimensions; dimension++)
			if(boxes[index + dimension] > boxes[index + dimensions + dimension])
				throw new RangeError(`Box ${index / stride} has a lower coordinate above its upper coordinate`);
	const module = await initRuntime();
	const input = module._malloc(Math.max(4, boxes.byteLength));
	if(!input) throw new Error("Unable to allocate box input");
	let handle;
	try
	{
		module.HEAPU8.set(new Uint8Array(boxes.buffer, boxes.byteOffset, boxes.byteLength), input);
		handle = module._lean_sweep_prepare_c(input, boxes.length, dimensions, axis) >>> 0;
	}
	finally
	{ module._free(input); }
	if(!handle) throw new Error("Lean rejected the box snapshot");
	const maximumPairs = count * (count - 1) / 2;
	const capacity = HEADER_WORDS + 4 * maximumPairs;
	const pointer = module._malloc(capacity * 4);
	if(!pointer)
	{
		module._lean_sweep_release(handle);
		throw new Error("Unable to allocate pair output");
	}
	let disposed = false;
	const solve = () => {
		if(disposed) throw new Error("Prepared boxes have been disposed");
		const length = module._lean_sweep_run(handle, pointer, capacity) >>> 0;
		if(length < HEADER_WORDS || length > capacity) throw new Error("Invalid Lean pair output length");
		const wire = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + length);
		if(wire[0] !== 0 || wire[1] !== count || wire[2] !== dimensions || wire[3] !== axis
			|| wire[4] > maximumPairs || wire[5] > wire[4] || length !== HEADER_WORDS + 2 * (wire[4] + wire[5]))
			throw new Error("Invalid Lean pair output header");
		const split = HEADER_WORDS + 2 * wire[4];
		return { candidates: wire.slice(HEADER_WORDS, split), overlaps: wire.slice(split) };
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_sweep_release(handle);
		module._free(pointer);
	};
	return solve;
};

/**
 * Find all projection candidates and exact box overlaps, releasing prepared storage.
 *
 * @param {object} request Packed Int32Array boxes, dimensions, and optional axis.
 */
export const findOverlaps = async request => {
	const solve = await prepareSweep(request);
	try
	{ return solve(); }
	finally
	{ solve.dispose(); }
};

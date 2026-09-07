/**
 * Typed-array API for the compiled Lean topological-sort component.
 *
 * @file
 */

import createLeanModule from "./runtime/lean-topological-sort.mjs";

const ERROR = 0xffff_ffff;
let modulePromise;
let scratchPointer = 0;
let scratchCapacity = 0;

/** Load and initialize the generated Emscripten module once. */
const loadModule = async () => {
	modulePromise ??= createLeanModule({
		locateFile: path => path === "lean-topological-sort.wasm"
			? new URL("./runtime/lean-topological-sort.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_topological_sort_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	});
	return modulePromise;
};

const reserveScratch = (module, words) => {
	const bytes = Math.max(words * Uint32Array.BYTES_PER_ELEMENT, 4);
	if(bytes <= scratchCapacity) return scratchPointer;
	const pointer = module._malloc(bytes);
	if(!pointer) throw new Error(`Unable to allocate ${bytes} Wasm bytes`);
	if(scratchPointer) module._free(scratchPointer);
	scratchPointer = pointer;
	scratchCapacity = bytes;
	return pointer;
};

const validate = ({ vertexCount, edges }) => {
	if(!Number.isSafeInteger(vertexCount) || vertexCount < 0 || vertexCount > 0xffff_fffe)
		throw new RangeError("vertexCount must be a nonnegative Uint32-compatible integer");
	if(!(edges instanceof Uint32Array) || edges.length % 2 !== 0)
		throw new TypeError("edges must be a Uint32Array of endpoint pairs");
	for(const endpoint of edges) if(endpoint >= vertexCount) throw new RangeError("edges contains an out-of-range endpoint");
};

const parse = (module, pointer, length) => {
	if(length < 1) throw new Error("Lean returned an empty topological result");
	const output = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + length);
	const tag = output[0];
	if(tag === 2) throw new Error("Lean could not certify the graph result");
	if(tag > 1) throw new Error("Lean returned an unknown topological result tag");
	return { kind: tag === 0 ? "order" : "cycle", vertices: Uint32Array.from(output.subarray(1)) };
};

/**
 * Sort a finite directed graph or return one directed cycle.
 *
 * @param request Vertex count and flat directed endpoint pairs.
 * @param entrypoint Exported Wasm function that handles this request.
 */
const runGraph = async (request, entrypoint) => {
	validate(request);
	const { vertexCount, edges } = request;
	const module = await loadModule();
	const pointer = reserveScratch(module, edges.length + vertexCount + 1);
	module.HEAPU32.set(edges, pointer >>> 2);
	const outputPointer = pointer + edges.byteLength;
	const length = module[entrypoint](
		vertexCount, pointer, edges.length, outputPointer, vertexCount + 1
	) >>> 0;
	if(length === ERROR) throw new Error("Lean rejected the topological-sort request");
	return parse(module, outputPointer, length);
};

/**
 * Sort a finite directed graph or return one directed cycle.
 *
 * @param request Vertex count and flat directed endpoint pairs.
 */
export const sortGraph = request => runGraph(request, "_lean_topological_sort_run");

/**
 * Run the constructive total solver directly, for independent fallback verification.
 *
 * @param request Vertex count and flat directed endpoint pairs.
 */
export const sortGraphTotal = request => runGraph(request, "_lean_topological_sort_run_total");

/**
 * Prepare an immutable graph and return a synchronous checked solver.
 * Each solver owns its graph and output allocation. Call solver.dispose() when done.
 *
 * @param request Immutable vertex count and directed endpoint pairs.
 */
export const prepareSort = async request => {
	validate(request);
	const { vertexCount, edges } = request;
	const module = await loadModule();
	const inputPointer = reserveScratch(module, edges.length);
	module.HEAPU32.set(edges, inputPointer >>> 2);
	const handle = module._lean_topological_sort_prepare(vertexCount, inputPointer, edges.length) >>> 0;
	if(!handle)
		throw new Error("Lean rejected the prepared graph");
	const outputPointer = module._malloc(Math.max((vertexCount + 1) * 4, 4));
	if(!outputPointer)
	{
		module._lean_topological_sort_release(handle);
		throw new Error("Unable to allocate prepared topological-sort output");
	}
	let disposed = false;
	const solve = () => {
		if(disposed) throw new Error("Prepared topological-sort solver has been disposed");
		const length = module._lean_topological_sort_run_prepared(handle, outputPointer, vertexCount + 1) >>> 0;
		if(length === ERROR) throw new Error("Lean rejected the prepared topological-sort request");
		return parse(module, outputPointer, length);
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_topological_sort_release(handle);
		module._free(outputPointer);
	};
	return solve;
};

/** Resolve after the compiled Lean runtime is initialized. */
export const ready = loadModule;

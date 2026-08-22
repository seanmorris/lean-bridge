/**
 * Generic JavaScript projection of the compiled Lean Dijkstra component.
 *
 * @file
 */

import createLeanModule from "./runtime/lean-dijkstra.mjs";

let modulePromise;
let scratchPointer = 0;
let scratchCapacity = 0;

/** Load and initialize the shared Lean runtime module. */
const loadModule = async () => {
	modulePromise ??= createLeanModule({
		locateFile: path => path === "lean-dijkstra.wasm"
			? new URL("./runtime/lean-dijkstra.wasm", import.meta.url).href
			: path
	}).then(module => {
		if(module._lean_demo_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	});
	return modulePromise;
};

const allocate = (module, bytes) => {
	const pointer = module._malloc(Math.max(bytes, 4));
	if(!pointer) throw new Error(`Unable to allocate ${bytes} Wasm bytes`);
	return pointer;
};

const reserveScratch = (module, bytes) => {
	if(bytes <= scratchCapacity) return scratchPointer;
	const pointer = allocate(module, bytes);
	if(scratchPointer) module._free(scratchPointer);
	scratchPointer = pointer;
	scratchCapacity = bytes;
	return pointer;
};

/**
 * Run the generic weighted-graph solver compiled from `DijkstraCore.lean`.
 *
 * @param root0 - Generic weighted graph request.
 * @param root0.vertexCount - Number of vertices represented by the matrix.
 * @param root0.offsets - CSR row offsets with `vertexCount + 1` entries.
 * @param root0.targets - CSR edge targets.
 * @param root0.weights - Non-negative edge weights parallel to `targets`.
 * @param root0.start - Source vertex.
 * @param root0.target - Target vertex.
 * @returns {Promise<number[]>} The certified shortest path, including both endpoints, or an empty array.
 */
export const shortestPath = async ({ vertexCount, offsets, targets, weights, start, target }) => {
	if(!(offsets instanceof Uint32Array) || offsets.length !== vertexCount + 1)
	{
		throw new TypeError("offsets must be a vertexCount + 1 Uint32Array");
	}
	if(!(targets instanceof Uint32Array) || !(weights instanceof Uint32Array)
		|| targets.length !== weights.length){
		throw new TypeError("targets and weights must be equal-length Uint32Arrays");
		}
	const module = await loadModule();
	const scratchBytes = offsets.byteLength + targets.byteLength + weights.byteLength
		+ vertexCount * Uint32Array.BYTES_PER_ELEMENT;
	const offsetsPointer = reserveScratch(module, scratchBytes);
	const targetsPointer = offsetsPointer + offsets.byteLength;
	const weightsPointer = targetsPointer + targets.byteLength;
	const outputPointer = weightsPointer + weights.byteLength;
	module.HEAPU32.set(offsets, offsetsPointer >>> 2);
	module.HEAPU32.set(targets, targetsPointer >>> 2);
	module.HEAPU32.set(weights, weightsPointer >>> 2);
	const length = module._lean_demo_solve(
		vertexCount,
		start,
		target,
		offsetsPointer,
		offsets.length,
		targetsPointer,
		weightsPointer,
		targets.length,
		outputPointer,
		vertexCount,
	) >>> 0;
	if(length === 0xffff_ffff) throw new Error("Lean Dijkstra bridge rejected the graph");
	return Array.from(module.HEAPU32.subarray(
		outputPointer >>> 2,
		(outputPointer >>> 2) + length,
	));
};

/** Resolve after the compiled Lean runtime is ready. */
export const ready = loadModule;

/**
 * Owned generic capacitated-graph handles for the compiled Lean max-flow solver.
 *
 * @file
 */

import createModule from "./runtime/lean-dinic.mjs";

const HEADER_WORDS = 11;
const WORD_BASE = 0x1_0000_0000;
let modulePromise;

/** Initialize the shared Lean/Wasm module once. */
export const initRuntime = () => {
	const pending = modulePromise ??= createModule({ locateFile: path => path === "lean-dinic.wasm"
		? new URL("./runtime/lean-dinic.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_dinic_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

const validate = ({ vertexCount, source, sink, offsets, targets, capacities }) => {
	if(!Number.isInteger(vertexCount) || vertexCount < 2 || vertexCount > 65_536)
		throw new RangeError("vertexCount must be an integer from 2 to 65,536");
	for(const [name, value] of Object.entries({ source, sink }))
		if(!Number.isInteger(value) || value < 0 || value >= vertexCount)
			throw new RangeError(`${name} must be an in-range vertex`);
	if(source === sink) throw new RangeError("source and sink must be distinct");
	for(const [name, values] of Object.entries({ offsets, targets, capacities }))
		if(!(values instanceof Uint32Array)) throw new TypeError(`${name} must be a Uint32Array`);
	if(offsets.length !== vertexCount + 1 || targets.length !== capacities.length)
		throw new RangeError("CSR array lengths do not match the vertex and edge counts");
	if(targets.length > 1_000_000) throw new RangeError("At most 1,000,000 directed edges are supported");
	if(offsets[0] !== 0 || offsets[vertexCount] !== targets.length)
		throw new RangeError("CSR offsets must start at zero and end at the edge count");
	for(let vertex = 0; vertex < vertexCount; vertex++)
		if(offsets[vertex] > offsets[vertex + 1] || offsets[vertex + 1] > targets.length)
			throw new RangeError("CSR offsets must be monotone and in bounds");
	for(const target of targets)
		if(target >= vertexCount) throw new RangeError("CSR contains an out-of-range target");
};

const wide = (wire, index) => {
	const value = wire[index] + wire[index + 1] * WORD_BASE;
	if(!Number.isSafeInteger(value)) throw new Error("Lean returned a total outside exact JavaScript integer range");
	return value;
};

/**
 * Snapshot a capacitated CSR network, preserving original edge order.
 *
 * @param request Vertex count, distinct terminals, CSR offsets/targets, and uint32 capacities.
 * @returns {Promise<((diagnostic?: boolean) => object) & {dispose: () => void}>} Owned synchronous solver.
 */
export const prepareGraph = async request => {
	validate(request);
	const { vertexCount, source, sink } = request;
	// Snapshot all caller-owned input before either awaiting or allocating in Wasm.
	const offsets = request.offsets.slice();
	const targets = request.targets.slice();
	const capacities = request.capacities.slice();
	const edgeCount = targets.length;
	const diagnosticAllowed = vertexCount <= 12 && edgeCount <= 24
		&& capacities.reduce((choices, capacity) => Math.min(100_001, choices * (capacity + 1)), 1) <= 100_000;
	const module = await initRuntime();
	const input = module._malloc((offsets.length + targets.length + capacities.length) * 4);
	if(!input) throw new Error("Unable to allocate max-flow input");
	let handle;
	try
	{
		module.HEAPU32.set(offsets, input >>> 2);
		module.HEAPU32.set(targets, (input >>> 2) + offsets.length);
		module.HEAPU32.set(capacities, (input >>> 2) + offsets.length + targets.length);
		handle = module._lean_dinic_prepare_c(vertexCount, source, sink, input,
			input + offsets.byteLength, input + offsets.byteLength + targets.byteLength, edgeCount) >>> 0;
	}
	finally
	{ module._free(input); }
	if(!handle) throw new RangeError("Lean rejected the flow network");
	const words = HEADER_WORDS + edgeCount + vertexCount;
	const pointer = module._malloc(words * 4);
	if(!pointer)
	{
		module._lean_dinic_release(handle);
		throw new Error("Unable to allocate max-flow output");
	}
	let disposed = false;
	const solve = (diagnostic = false) => {
		if(disposed) throw new Error("Prepared flow network has been disposed");
		if(typeof diagnostic !== "boolean") throw new TypeError("diagnostic must be a boolean");
		if(diagnostic && !diagnosticAllowed)
			throw new RangeError("Exhaustive diagnostics require at most 12 vertices, 24 edges, and 100,000 flow assignments");
		const length = module._lean_dinic_run(handle, diagnostic ? 1 : 0, pointer, words) >>> 0;
		if(length !== words) throw new Error("Invalid Lean max-flow result length");
		const wire = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + length);
		if(wire[0] !== 0 || wire[5] !== vertexCount || wire[6] !== edgeCount || wire[10] > 1)
			throw new Error("Invalid Lean max-flow result header");
		return { value: wide(wire, 1), cutCapacity: wide(wire, 3)
			, phaseCount: wire[7]
			, augmentationCount: wide(wire, 8)
			, usedFallback: wire[10] === 1
			, flows: wire.slice(HEADER_WORDS, HEADER_WORDS + edgeCount)
			, sourceSide: wire.slice(HEADER_WORDS + edgeCount)
		};
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_dinic_release(handle);
		module._free(pointer);
	};
	return solve;
};

/**
 * Solve one network and release its prepared handle.
 *
 * @param {object} request Generic capacitated CSR network.
 */
export const solveGraph = async request => {
	const solve = await prepareGraph(request);
	try
	{ return solve(); } finally
	{ solve.dispose(); }
};

/**
 * Exercise the proved reference directly on tiny diagnostic networks.
 *
 * @param {object} request Generic capacitated CSR network.
 */
export const solveGraphTotal = async request => {
	const solve = await prepareGraph(request);
	try
	{ return solve(true); } finally
	{ solve.dispose(); }
};

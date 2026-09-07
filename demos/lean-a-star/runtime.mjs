/**
 * Independent prepared graph handles for the compiled, checked A* solver.
 *
 * @file
 */

import createModule from "./runtime/lean-a-star.mjs";

const MAX_NAT = 0x7fff_ffff;
const MAX_ALLOCATION_WORDS = 0x3fff_ffff;
let modulePromise;

/** Initialize the Lean runtime once. */
export const initRuntime = () => {
	modulePromise ??= createModule({
		locateFile: path => path === "lean-a-star.wasm"
			? new URL("./runtime/lean-a-star.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_astar_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	});
	return modulePromise;
};

const validate = request => {
	const { vertexCount, offsets, targets, weights, heuristic, start, target } = request;
	if(!Number.isSafeInteger(vertexCount) || vertexCount < 1 || vertexCount > MAX_NAT)
		throw new RangeError("vertexCount must be a positive 31-bit integer");
	if(2 * vertexCount + 6 > MAX_ALLOCATION_WORDS)
		throw new RangeError("Search output exceeds the Wasm32 allocation limit");
	for(const endpoint of [start, target])
		if(!Number.isSafeInteger(endpoint) || endpoint < 0 || endpoint >= vertexCount)
			throw new RangeError("start and target must be valid vertex indices");
	for(const [name, array] of Object.entries({ offsets, targets, weights, heuristic }))
		if(!(array instanceof Uint32Array)) throw new TypeError(`${name} must be a Uint32Array`);
	if(offsets.length !== vertexCount + 1 || targets.length !== weights.length || heuristic.length !== vertexCount)
		throw new RangeError("CSR and heuristic array sizes do not match vertexCount");
	if(offsets.length + targets.length + weights.length + heuristic.length > MAX_ALLOCATION_WORDS)
		throw new RangeError("Graph input exceeds the Wasm32 allocation limit");
	if(offsets[0] !== 0 || offsets[vertexCount] !== targets.length)
		throw new RangeError("CSR offsets must start at zero and end at the edge count");
	let maximum = 0;
	const seen = new Uint32Array(vertexCount);
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		if(offsets[vertex] > offsets[vertex + 1] || offsets[vertex + 1] > targets.length)
			throw new RangeError("CSR offsets must be monotone and in bounds");
		if(heuristic[vertex] > MAX_NAT) throw new RangeError("Heuristic values must fit a 31-bit natural");
		for(let index = offsets[vertex]; index < offsets[vertex + 1]; index += 1)
		{
			const next = targets[index];
			if(next >= vertexCount) throw new RangeError("CSR contains an out-of-range target");
			if(seen[next] === vertex + 1) throw new RangeError("Duplicate targets in a CSR row are not supported");
			seen[next] = vertex + 1;
			maximum = Math.max(maximum, weights[index]);
		}
	}
	if((maximum + 1) * (vertexCount + 1) > MAX_NAT)
		throw new RangeError("Graph costs exceed the 31-bit wire-format bound");
};

const parse = (module, pointer, length) => {
	if(length === 0xffff_ffff || length < 5) throw new Error("Lean rejected the prepared search");
	const output = module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + length);
	const [tag, cost, fallback, pathLength, expansionLength] = output;
	if(tag > 1 || 5 + pathLength + expansionLength !== length)
		throw new Error("Invalid Lean search result encoding");
	return {
		kind: tag === 0 ? "path" : "unreachable", cost, usedFallback: fallback === 1
		, path: output.slice(5, 5 + pathLength)
		, expanded: output.slice(5 + pathLength)
	};
};

/**
 * Copy a generic graph and check its heuristic once. The returned synchronous
 * search owns its input and output allocations; call search.dispose() when done.
 *
 * @param request CSR graph, natural heuristic, source and goal.
 */
export const prepareSearch = async request => {
	validate(request);
	const { vertexCount, offsets, targets, weights, heuristic, start, target } = request;
	const module = await initRuntime();
	const words = offsets.length + targets.length + weights.length + heuristic.length;
	const pointer = module._malloc(words * 4);
	if(!pointer) throw new Error("Unable to allocate A* graph input");
	let handle;
	try
	{
		let cursor = pointer >>> 2;
		for(const values of [offsets, targets, weights, heuristic])
		{
			module.HEAPU32.set(values, cursor);
			cursor += values.length;
		}
		handle = module._lean_astar_prepare_c(vertexCount, start, target, pointer
			, pointer + offsets.byteLength, pointer + offsets.byteLength + targets.byteLength
			, pointer + offsets.byteLength + targets.byteLength + weights.byteLength, targets.length) >>> 0;
	}
	finally
	{ module._free(pointer); }
	if(!handle) throw new RangeError("Lean rejected the graph or heuristic: estimates must be consistent and zero at the goal");
	const capacity = 2 * vertexCount + 6;
	const output = module._malloc(capacity * 4);
	if(!output)
	{
		module._lean_astar_release(handle);
		throw new Error("Unable to allocate A* search output");
	}
	let disposed = false;
	const search = (diagnostic = false) => {
		if(disposed) throw new Error("Prepared A* search has been disposed");
		return parse(module, output, module._lean_astar_run(handle, diagnostic ? 1 : 0, output, capacity) >>> 0);
	};
	search.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_astar_release(handle);
		module._free(output);
	};
	return search;
};

/**
 * Solve one request and release its prepared graph immediately afterward.
 *
 * @param request CSR graph and consistent heuristic.
 */
export const solveGraph = async request => {
	const search = await prepareSearch(request);
	try
	{ return search(); } finally
	{ search.dispose(); }
};

/**
 * Exercise the proved total fallback directly, for small diagnostic graphs.
 *
 * @param request CSR graph and consistent heuristic.
 */
export const solveGraphTotal = async request => {
	const search = await prepareSearch(request);
	try
	{ return search(true); } finally
	{ search.dispose(); }
};

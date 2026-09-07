/**
 * Owned prepared graph handles for the compiled Lean SCC solver.
 *
 * @file
 */

import createModule from "./runtime/lean-tarjan.mjs";

const MAX_NAT = 0x7fff_ffff;
const MAX_ALLOCATION_WORDS = 0x3fff_ffff;
let modulePromise;

/** Initialize the Lean runtime once. */
export const initRuntime = () => {
	modulePromise ??= createModule({
		locateFile: path => path === "lean-tarjan.wasm"
			? new URL("./runtime/lean-tarjan.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_tarjan_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	});
	return modulePromise;
};

const validate = ({ vertexCount, offsets, targets }) => {
	if(!Number.isSafeInteger(vertexCount) || vertexCount < 0 || vertexCount > MAX_NAT)
		throw new RangeError("vertexCount must be a nonnegative 31-bit integer");
	if(vertexCount + 1 > MAX_ALLOCATION_WORDS)
		throw new RangeError("Graph output exceeds the Wasm32 allocation limit");
	for(const [name, values] of Object.entries({ offsets, targets }))
		if(!(values instanceof Uint32Array)) throw new TypeError(`${name} must be a Uint32Array`);
	if(offsets.length !== vertexCount + 1)
		throw new RangeError("CSR offsets must contain vertexCount + 1 entries");
	if(offsets.length + targets.length > MAX_ALLOCATION_WORDS)
		throw new RangeError("Graph input exceeds the Wasm32 allocation limit");
	if(offsets[0] !== 0 || offsets[vertexCount] !== targets.length)
		throw new RangeError("CSR offsets must start at zero and end at the edge count");
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
		if(offsets[vertex] > offsets[vertex + 1] || offsets[vertex + 1] > targets.length)
			throw new RangeError("CSR offsets must be monotone and in bounds");
	for(const target of targets)
		if(target >= vertexCount) throw new RangeError("CSR contains an out-of-range target");
};

// The browser groups and draws these proved labels; it does not compute SCCs.
const describe = (labels, offsets, targets, usedFallback) => {
	const members = new Map();
	for(let vertex = 0; vertex < labels.length; vertex += 1)
	{
		const root = labels[vertex];
		if(root >= labels.length || labels[root] !== root) throw new Error("Invalid Lean component label");
		if(!members.has(root)) members.set(root, []);
		members.get(root).push(vertex);
	}
	const roots = [...members.keys()].sort((left, right) => left - right);
	const links = new Map(roots.map(root => [root, new Set()]));
	for(let vertex = 0; vertex < labels.length; vertex += 1)
		for(let index = offsets[vertex]; index < offsets[vertex + 1]; index += 1)
			if(labels[vertex] !== labels[targets[index]]) links.get(labels[vertex]).add(labels[targets[index]]);
	const pairs = [];
	for(const root of roots)
		for(const target of [...links.get(root)].sort((left, right) => left - right)) pairs.push(root, target);
	return { labels, componentCount: roots.length
		, components: roots.map(root => Uint32Array.from(members.get(root)))
		, condensation: Uint32Array.from(pairs), usedFallback };
};

/**
 * Copy and prepare a generic CSR graph. The synchronous solver owns its graph
 * until dispose() is called; independent handles may safely be interleaved.
 *
 * @param request Directed CSR graph, including empty graphs and duplicate edges.
 */
export const prepareGraph = async request => {
	validate(request);
	// Snapshot before awaiting initialization so caller mutation cannot change the request.
	const { vertexCount } = request;
	const offsets = request.offsets.slice();
	const targets = request.targets.slice();
	const module = await initRuntime();
	const pointer = module._malloc((offsets.length + targets.length) * 4);
	if(!pointer) throw new Error("Unable to allocate SCC graph input");
	let handle;
	try
	{
		module.HEAPU32.set(offsets, pointer >>> 2);
		module.HEAPU32.set(targets, (pointer >>> 2) + offsets.length);
		handle = module._lean_tarjan_prepare_c(vertexCount, pointer, pointer + offsets.byteLength, targets.length) >>> 0;
	}
	finally
	{ module._free(pointer); }
	if(!handle) throw new RangeError("Lean rejected the graph");
	const capacity = vertexCount + 1;
	const output = module._malloc(capacity * 4);
	if(!output)
	{
		module._lean_tarjan_release(handle);
		throw new Error("Unable to allocate SCC result");
	}
	let disposed = false;
	const solve = (diagnostic = false) => {
		if(disposed) throw new Error("Prepared SCC graph has been disposed");
		const length = module._lean_tarjan_run(handle, diagnostic ? 1 : 0, output, capacity) >>> 0;
		if(length !== capacity) throw new Error("Invalid Lean SCC result length");
		const wire = module.HEAPU32.subarray(output >>> 2, (output >>> 2) + length);
		if(wire[vertexCount] > 1) throw new Error("Invalid Lean SCC fallback flag");
		return describe(wire.slice(0, vertexCount), offsets, targets, wire[vertexCount] === 1);
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_tarjan_release(handle);
		module._free(output);
	};
	return solve;
};

/**
 * Solve one directed graph and release its prepared handle.
 *
 * @param request Generic directed CSR graph.
 */
export const solveGraph = async request => {
	const solve = await prepareGraph(request);
	try
	{ return solve(); } finally
	{ solve.dispose(); }
};

/**
 * Exercise the proved cubic reference directly on small diagnostic graphs.
 *
 * @param request Generic directed CSR graph.
 */
export const solveGraphTotal = async request => {
	const solve = await prepareGraph(request);
	try
	{ return solve(true); } finally
	{ solve.dispose(); }
};

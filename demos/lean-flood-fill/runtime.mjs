/**
 * Typed-array JavaScript API for the proven Lean flood-fill component.
 *
 * @file
 */

import createLeanModule from "./runtime/lean-flood-fill.mjs";

const ERROR = 0xffff_ffff;
let modulePromise;
let scratchPointer = 0;
let scratchCapacity = 0;

/** Load and initialize the compiled Lean module once. */
const loadModule = async () => {
	const pending = modulePromise ??= createLeanModule({
		locateFile: path => path === "lean-flood-fill.wasm"
			? new URL("./runtime/lean-flood-fill.wasm", import.meta.url).href
			: path
	}).then(module => {
		if(module._lean_flood_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

const reserveScratch = (module, words) => {
	if(!Number.isSafeInteger(words) || words < 0 || words > 0x3fff_ffff)
		throw new RangeError("Graph storage exceeds the Wasm32 allocation limit");
	const bytes = Math.max(words * Uint32Array.BYTES_PER_ELEMENT, 4);
	if(bytes <= scratchCapacity) return scratchPointer;
	const pointer = module._malloc(bytes);
	if(!pointer) throw new Error(`Unable to allocate ${bytes} Wasm bytes`);
	if(scratchPointer) module._free(scratchPointer);
	scratchPointer = pointer;
	scratchCapacity = bytes;
	return pointer;
};

const requireArray = (value, name, length) => {
	if(!(value instanceof Uint32Array) || (length !== undefined && value.length !== length))
	{
		throw new TypeError(`${name} must be a Uint32Array${length === undefined ? "" : ` of length ${length}`}`);
	}
};

const validateGraph = ({ vertexCount, offsets, targets, allowedVertices }) => {
	if(!Number.isInteger(vertexCount) || vertexCount <= 0 || vertexCount > 0x7fff_ffff)
		throw new RangeError("vertexCount must be a positive 31-bit integer");
	requireArray(offsets, "offsets", vertexCount + 1);
	requireArray(targets, "targets");
	requireArray(allowedVertices, "allowedVertices", vertexCount);
	if(offsets[0] !== 0 || offsets[vertexCount] !== targets.length)
		throw new RangeError("CSR offsets must start at zero and end at the edge count");
	for(let vertex = 0; vertex < vertexCount; vertex++)
		if(offsets[vertex] > offsets[vertex + 1] || offsets[vertex + 1] > targets.length)
			throw new RangeError("CSR offsets must be monotone and in bounds");
	for(const target of targets)
		if(target >= vertexCount) throw new RangeError("CSR contains an out-of-range target");
};

const transfer = (module, arrays, outputWords) => {
	const inputWords = arrays.reduce((total, values) => total + values.length, 0);
	const base = reserveScratch(module, inputWords + outputWords);
	let wordOffset = base >>> 2;
	const pointers = arrays.map(values => {
		const pointer = wordOffset << 2;
		module.HEAPU32.set(values, wordOffset);
		wordOffset += values.length;
		return pointer;
	});
	return { pointers, outputPointer: wordOffset << 2 };
};

/**
 * Return exactly the vertices reachable through enabled directed edges.
 *
 * @param request - Generic CSR reachability request.
 * @param request.vertexCount - Number of graph vertices.
 * @param request.offsets - CSR row offsets.
 * @param request.targets - CSR edge targets.
 * @param request.allowedVertices - Per-vertex zero/one eligibility flags.
 * @param request.allowedEdges - Per-edge zero/one traversal flags.
 * @param request.start - Start vertex.
 * @returns {Promise<Uint32Array>} Reachable vertex indices in ascending order.
 */
export const reachable = async ({
	vertexCount, offsets, targets, allowedVertices, allowedEdges, start
}) => {
	validateGraph({ vertexCount, offsets, targets, allowedVertices });
	requireArray(allowedEdges, "allowedEdges", targets.length);
	if(!Number.isInteger(start) || start < 0 || start >= vertexCount) throw new RangeError("start is out of range");
	offsets = offsets.slice(); targets = targets.slice();
	allowedVertices = allowedVertices.slice(); allowedEdges = allowedEdges.slice();
	const module = await loadModule();
	const { pointers, outputPointer } = transfer(module,
		[offsets, targets, allowedEdges, allowedVertices], vertexCount);
	const length = module._lean_flood_solve(
		vertexCount, start, pointers[0], offsets.length, pointers[1], pointers[2], targets.length,
		pointers[3], outputPointer, vertexCount
	) >>> 0;
	if(length === ERROR) throw new Error("Lean flood-fill bridge rejected the graph");
	return Uint32Array.from(module.HEAPU32.subarray(outputPointer >>> 2, (outputPointer >>> 2) + length));
};

/**
 * Compute the least stable reachability/capability closure.
 *
 * @param request - Generic gated CSR request.
 * @param request.vertexCount - Number of graph vertices.
 * @param request.offsets - CSR row offsets.
 * @param request.targets - CSR edge targets.
 * @param request.allowedVertices - Per-vertex zero/one eligibility flags.
 * @param request.requirements - Required capability per edge; capabilityCount means unrestricted.
 * @param request.grants - Granted capability per vertex; capabilityCount means no grant.
 * @param request.initialCapabilities - Initially available capability identifiers.
 * @param request.capabilityCount - Number of valid capabilities.
 * @param request.start - Start vertex.
 * @returns {Promise<{vertices: Uint32Array, capabilities: Uint32Array}>} The least stable closure.
 */
export const reachableWithCapabilities = async ({
	vertexCount, offsets, targets, allowedVertices, requirements, grants
	, initialCapabilities, capabilityCount, start
}) => {
	validateGraph({ vertexCount, offsets, targets, allowedVertices });
	requireArray(requirements, "requirements", targets.length);
	requireArray(grants, "grants", vertexCount);
	requireArray(initialCapabilities, "initialCapabilities");
	if(!Number.isInteger(capabilityCount) || capabilityCount < 0 || capabilityCount > 0x7fff_ffff)
		throw new RangeError("capabilityCount is invalid");
	if(!Number.isInteger(start) || start < 0 || start >= vertexCount) throw new RangeError("start is out of range");
	offsets = offsets.slice(); targets = targets.slice(); allowedVertices = allowedVertices.slice();
	requirements = requirements.slice(); grants = grants.slice(); initialCapabilities = initialCapabilities.slice();
	const module = await loadModule();
	const outputCapacity = vertexCount + capabilityCount + 1;
	const { pointers, outputPointer } = transfer(module,
		[offsets, targets, requirements, allowedVertices, grants, initialCapabilities], outputCapacity);
	const length = module._lean_capability_solve(
		vertexCount, capabilityCount, start, pointers[0], offsets.length, pointers[1], pointers[2],
		targets.length, pointers[3], pointers[4], pointers[5], initialCapabilities.length,
		outputPointer, outputCapacity
	) >>> 0;
	if(length === ERROR) throw new Error("Lean capability bridge rejected the graph");
	if(length === 0) return { vertices: new Uint32Array(), capabilities: new Uint32Array() };
	const output = module.HEAPU32.subarray(outputPointer >>> 2, (outputPointer >>> 2) + length);
	const vertexLength = output[0];
	if(vertexLength + 1 > length) throw new Error("Lean capability result is malformed");
	return {
		vertices: Uint32Array.from(output.subarray(1, vertexLength + 1))
		, capabilities: Uint32Array.from(output.subarray(vertexLength + 1))
	};
};

/**
 * Prepare an immutable gated graph once for repeated certified closures.
 *
 * @param request - Generic gated CSR request.
 * @returns {Promise<() => {vertices: Uint32Array, capabilities: Uint32Array}>} Prepared solver.
 */
export const prepareCapabilityClosure = async request => {
	let {
		vertexCount, offsets, targets, allowedVertices, requirements, grants
		, initialCapabilities, capabilityCount, start
	} = request;
	validateGraph({ vertexCount, offsets, targets, allowedVertices });
	requireArray(requirements, "requirements", targets.length);
	requireArray(grants, "grants", vertexCount);
	requireArray(initialCapabilities, "initialCapabilities");
	if(!Number.isInteger(capabilityCount) || capabilityCount < 0 || capabilityCount > 0x7fff_ffff)
		throw new RangeError("capabilityCount is invalid");
	if(!Number.isInteger(start) || start < 0 || start >= vertexCount) throw new RangeError("start is out of range");
	offsets = offsets.slice(); targets = targets.slice(); allowedVertices = allowedVertices.slice();
	requirements = requirements.slice(); grants = grants.slice(); initialCapabilities = initialCapabilities.slice();
	const module = await loadModule();
	const arrays = [offsets, targets, requirements, allowedVertices, grants, initialCapabilities];
	const { pointers } = transfer(module, arrays, 0);
	const handle = module._lean_capability_prepare(
		vertexCount, capabilityCount, start, pointers[0], offsets.length, pointers[1], pointers[2]
		, targets.length, pointers[3], pointers[4], pointers[5], initialCapabilities.length
	) >>> 0;
	if(handle === 0) throw new Error("Lean flood-fill bridge rejected the prepared graph");
	let disposed = false;
	const solve = () => {
		if(disposed) throw new Error("Prepared flood-fill graph has been disposed");
		const outputCapacity = vertexCount + capabilityCount + 1;
		const outputPointer = reserveScratch(module, outputCapacity);
		const length = module._lean_capability_solve_prepared(
			handle, outputPointer, outputCapacity
		) >>> 0;
		if(length === ERROR) throw new Error("Prepared Lean flood-fill graph is no longer active");
		if(length === 0) return { vertices: new Uint32Array(), capabilities: new Uint32Array() };
		const output = module.HEAPU32.subarray(outputPointer >>> 2, (outputPointer >>> 2) + length);
		const vertexLength = output[0];
		if(vertexLength + 1 > length) throw new Error("Lean capability result is malformed");
		return {
			vertices: Uint32Array.from(output.subarray(1, vertexLength + 1))
			, capabilities: Uint32Array.from(output.subarray(vertexLength + 1))
		};
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_capability_release(handle);
	};
	return solve;
};

/** Resolve after the compiled Lean runtime is initialized. */
export const ready = loadModule;

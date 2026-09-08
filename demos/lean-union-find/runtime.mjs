/**
 * Typed-array API for the compiled Lean union-find component.
 *
 * @file
 */

import createLeanModule from "./runtime/lean-union-find.mjs";

export const UNION = 0;
export const CONNECTED = 1;

const ERROR = 0xffff_ffff;
let modulePromise;
let scratchPointer = 0;
let scratchCapacity = 0;

/** Loads the generated module and initializes its Lean runtime. */
const loadModule = async () => {
	const pending = modulePromise ??= createLeanModule({
		locateFile: path => path === "lean-union-find.wasm"
			? new URL("./runtime/lean-union-find.wasm", import.meta.url).href
			: path
	}).then(module => {
		if(module._lean_union_find_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

const reserveScratch = (module, words) => {
	if(!Number.isSafeInteger(words) || words < 0 || words > 0x3fff_ffff)
		throw new RangeError("Partition storage exceeds the Wasm32 allocation limit");
	const bytes = Math.max(words * Uint32Array.BYTES_PER_ELEMENT, 4);
	if(bytes <= scratchCapacity) return scratchPointer;
	const pointer = module._malloc(bytes);
	if(!pointer) throw new Error(`Unable to allocate ${bytes} Wasm bytes`);
	if(scratchPointer) module._free(scratchPointer);
	scratchPointer = pointer;
	scratchCapacity = bytes;
	return pointer;
};

const requireCount = count => {
	if(!Number.isSafeInteger(count) || count < 0 || count > 0x7fff_ffff)
	{
		throw new RangeError("elementCount must be a nonnegative 31-bit integer");
	}
};

const requireArray = (values, name, multiple) => {
	if(!(values instanceof Uint32Array)) throw new TypeError(`${name} must be a Uint32Array`);
	if(values.length % multiple !== 0) throw new RangeError(`${name} length must be divisible by ${multiple}`);
};

const transfer = (module, input, outputWords) => {
	const pointer = reserveScratch(module, input.length + outputWords);
	module.HEAPU32.set(input, pointer >>> 2);
	return { inputPointer: pointer, outputPointer: pointer + input.byteLength };
};

const parsePartition = (module, outputPointer, count) => {
	const start = outputPointer >>> 2;
	return {
		representatives: Uint32Array.from(module.HEAPU32.subarray(start, start + count))
		, parents: Uint32Array.from(module.HEAPU32.subarray(start + count, start + count * 2))
		, sizes: Uint32Array.from(module.HEAPU32.subarray(start + count * 2, start + count * 3))
	};
};

/**
 * Build the exact partition induced by a flat array of undirected endpoint pairs.
 *
 * @param root0 Partition request.
 * @param root0.elementCount Number of finite elements to partition.
 * @param root0.links Flat undirected endpoint pairs.
 */
export const partition = async ({ elementCount, links }) => {
	requireCount(elementCount);
	requireArray(links, "links", 2);
	for(const endpoint of links)
	{
		if(endpoint >= elementCount) throw new RangeError("links contains an out-of-range endpoint");
	}
	links = links.slice();
	const module = await loadModule();
	const outputWords = elementCount;
	const { inputPointer, outputPointer } = transfer(module, links, outputWords);
	const length = module._lean_union_find_solve(
		elementCount, inputPointer, links.length, outputPointer, outputWords
	) >>> 0;
	if(length === ERROR || length !== outputWords) throw new Error("Lean union-find rejected the partition");
	const start = outputPointer >>> 2;
	return { representatives: Uint32Array.from(module.HEAPU32.subarray(start, start + elementCount)) };
};

/**
 * Prepare one fixed graph and return a synchronous partition operation for benchmarking.
 * Input conversion happens once; each call runs the checked Lean implementation and copies
 * its representatives out of Wasm memory.
 *
 * @param root0 Partition request.
 * @param root0.elementCount Number of finite elements to partition.
 * @param root0.links Flat undirected endpoint pairs.
 * @returns {Promise<() => {representatives: Uint32Array}>} Prepared operation.
 */
export const preparePartition = async ({ elementCount, links }) => {
	requireCount(elementCount);
	requireArray(links, "links", 2);
	for(const endpoint of links)
	{
		if(endpoint >= elementCount) throw new RangeError("links contains an out-of-range endpoint");
	}
	if(elementCount > 0x3fff_ffff) throw new RangeError("Partition output exceeds the Wasm32 allocation limit");
	links = links.slice();
	const module = await loadModule();
	const inputPointer = reserveScratch(module, links.length);
	module.HEAPU32.set(links, inputPointer >>> 2);
	const handle = module._lean_union_find_prepare_partition(elementCount, inputPointer, links.length) >>> 0;
	if(!handle)
	{
		throw new Error("Lean union-find rejected the prepared partition");
	}
	const outputBytes = Math.max(elementCount * Uint32Array.BYTES_PER_ELEMENT, 4);
	const outputPointer = module._malloc(outputBytes);
	if(!outputPointer)
	{
		module._lean_union_find_release_partition(handle);
		throw new Error(`Unable to allocate ${outputBytes} Wasm bytes`);
	}
	let disposed = false;
	const solve = () => {
		if(disposed) throw new Error("Prepared partition has been disposed");
		const length = module._lean_union_find_solve_prepared_partition(
			handle, outputPointer, elementCount
		) >>> 0;
		if(length === ERROR || length !== elementCount)
		{
			throw new Error("Lean union-find rejected the prepared partition");
		}
		const start = outputPointer >>> 2;
		return {
			representatives: Uint32Array.from(module.HEAPU32.subarray(start, start + elementCount))
		};
	};
	solve.dispose = () => {
		if(disposed) return;
		disposed = true;
		module._lean_union_find_release_partition(handle);
		module._free(outputPointer);
	};
	return solve;
};

/**
 * Build a diagnostic partition that also exposes the internal parent and size arrays.
 *
 * @param root0 Partition request.
 * @param root0.elementCount Number of finite elements to partition.
 * @param root0.links Flat undirected endpoint pairs.
 */
export const partitionDebug = async ({ elementCount, links }) => {
	requireCount(elementCount);
	requireArray(links, "links", 2);
	for(const endpoint of links)
	{
		if(endpoint >= elementCount) throw new RangeError("links contains an out-of-range endpoint");
	}
	links = links.slice();
	const module = await loadModule();
	const outputWords = elementCount * 3;
	const { inputPointer, outputPointer } = transfer(module, links, outputWords);
	const length = module._lean_union_find_solve_debug(
		elementCount, inputPointer, links.length, outputPointer, outputWords
	) >>> 0;
	if(length === ERROR || length !== outputWords) throw new Error("Lean union-find rejected the diagnostic partition");
	return parsePartition(module, outputPointer, elementCount);
};

/**
 * Execute UNION and CONNECTED triples in order and return the query results.
 *
 * @param root0 Operation-stream request.
 * @param root0.elementCount Number of finite elements in the forest.
 * @param root0.operations Flat opcode and endpoint triples.
 */
export const runOperations = async ({ elementCount, operations }) => {
	requireCount(elementCount);
	requireArray(operations, "operations", 3);
	let queryCount = 0;
	for(let index = 0; index < operations.length; index += 3)
	{
		const opcode = operations[index];
		if(opcode !== UNION && opcode !== CONNECTED) throw new RangeError("operations contains an unknown opcode");
		if(operations[index + 1] >= elementCount || operations[index + 2] >= elementCount)
		{
			throw new RangeError("operations contains an out-of-range endpoint");
		}
		if(opcode === CONNECTED) queryCount += 1;
	}
	operations = operations.slice();
	const module = await loadModule();
	const outputWords = 1 + queryCount + elementCount * 3;
	const { inputPointer, outputPointer } = transfer(module, operations, outputWords);
	const length = module._lean_union_find_run_operations(
		elementCount, inputPointer, operations.length, outputPointer, outputWords
	) >>> 0;
	if(length === ERROR || length !== outputWords) throw new Error("Lean union-find rejected the operation stream");
	const start = outputPointer >>> 2;
	if(module.HEAPU32[start] !== queryCount) throw new Error("Lean union-find returned a malformed query count");
	const partitionStart = outputPointer + (1 + queryCount) * Uint32Array.BYTES_PER_ELEMENT;
	return {
		queries: Uint32Array.from(module.HEAPU32.subarray(start + 1, start + 1 + queryCount))
		, ...parsePartition(module, partitionStart, elementCount)
	};
};

/** Loads and initializes the compiled Lean module. */
export const ready = loadModule;

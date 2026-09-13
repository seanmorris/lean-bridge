/**
 * Bounded, independently owned calls into the compiled Lean certificate.
 *
 * @file
 */
let pending;
let loadAttempt = 0;

/** Load the Lean runtime and return a synchronous exact certificate checker. */
export const createChecker = async () => {
	// Failed module imports are cached. Retry both this adapter and its generated loader.
	const loader = new URL("./runtime/lean-tutte.mjs", import.meta.url);
	loader.search = new URL(import.meta.url).search;
	if(loadAttempt) loader.searchParams.set("load-attempt", String(loadAttempt));
	const loading = pending ??= import(/* @vite-ignore */ loader.href)
		.then(({ default: createModule }) => createModule({ locateFile: name => new URL(`./runtime/${name}`, import.meta.url).href }))
		.then(module => {
			if(module._tutte_init() !== 1) throw new Error("Lean initialization failed");
			return module;
		}).catch(error => { pending = undefined; loadAttempt++; throw error; });
	const module = await loading;
	return ({ width, height, levels, squares }) => {
		if(![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 256)) throw new RangeError("Dimensions must be integers from 1 to 256");
		if(!(levels instanceof Uint32Array) || !(squares instanceof Uint32Array)) throw new TypeError("Levels and squares must be Uint32Array values");
		if(levels.length < 2 || levels.length > 26 || !squares.length || squares.length % 5 || squares.length > 60) throw new RangeError("Expected 2–26 junctions and 1–12 square records");
		if([...levels, ...squares].some(word => word > 256)) throw new RangeError("Coordinates and indices must not exceed 256");
		// Snapshot before allocation, which can grow and detach the Wasm heap.
		const input = new Uint32Array([...levels, ...squares]);
		const outputWords = 5 + 2 * levels.length;
		const pointer = module._malloc((input.length + outputWords) * 4);
		if(!pointer) throw new Error("Unable to allocate the certificate input");
		try
		{
			module.HEAPU32.set(input, pointer >>> 2);
			const output = pointer + input.length * 4;
			const count = module._tutte_verify(width, height, pointer, levels.length, pointer + levels.length * 4, squares.length, output);
			if(count !== outputWords) throw new Error("Invalid Lean certificate response");
			const values = module.HEAPU32.slice(output >>> 2, (output >>> 2) + count);
			if(values.slice(0, 5).some(value => value > 1)) throw new Error("Invalid Lean certificate flags");
			return { tiling: values[0] === 1, electrical: values[1] === 1
				, simple: values[2] === 1, perfect: values[3] === 1
				, threeConnected: values[4] === 1
				, balances: Array.from({ length: levels.length }, (_, n) => ({ incoming: values[5 + n * 2], outgoing: values[6 + n * 2] })) };
		}
		finally
		{ module._free(pointer); }
	};
};

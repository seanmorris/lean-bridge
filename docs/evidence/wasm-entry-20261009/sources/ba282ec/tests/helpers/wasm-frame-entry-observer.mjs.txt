/**
 * Test-only counters for the private scalar/copied Wasm frame ABI, (i32) -> i32.
 * Run in an exclusive realm while the loader instantiates the exact component bytes.
 * This observes selected adapter entries, not Lean source calls or installed acceptance.
 *
 * @file
 */

const require = (condition, message) => { if(!condition) throw new Error(message); };
const bytesOf = input => ArrayBuffer.isView(input)
	? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
	: input instanceof ArrayBuffer ? new Uint8Array(input) : null;
const equal = (left, right) => left?.length === right.length && right.every((byte, index) => left[index] === byte);
const vector = parts => [parts.length, ...parts.flat()];
const name = text => { const bytes = [...new TextEncoder().encode(text)]; return [bytes.length, ...bytes]; };
const section = (id, bytes) => [id, bytes.length, ...bytes];
// All sections and names here are fixed and shorter than 128 bytes. Importing a Wasm
// function with a different signature fails at link time; the counter has no parameters.
const trampolineBytes = new Uint8Array([
	0, 97, 115, 109, 1, 0, 0, 0
	, ...section(1, vector([[0x60, 1, 0x7f, 1, 0x7f], [0x60, 0, 0]]))
	, ...section(2, vector([[...name("probe"), ...name("original"), 0, 0], [...name("probe"), ...name("enter"), 0, 1]]))
	, ...section(3, [1, 0])
	, ...section(7, [1, ...name("entry"), 0, 2])
	, ...section(10, [1, 8, 0, 0x10, 1, 0x20, 0, 0x10, 0, 0x0b])
]);
let observing = false;

/**
 * Produce a native funcref with the exact frame signature. A JS replacement is refused.
 *
 * @param original - Original Wasm adapter export.
 * @param enter - Counter increment, immediately before entering the adapter.
 */
export const wasmFrameEntry = (original, enter) => {
	require(typeof original === "function" && typeof enter === "function", "frame entry needs two functions");
	new WebAssembly.Table({ initial: 1, element: "anyfunc" }).set(0, original);
	const module = new WebAssembly.Module(trampolineBytes);
	return new WebAssembly.Instance(module, { probe: { original, enter } }).exports.entry;
};

/**
 * Observe one component instantiation without rewriting its bytes. Unknown modules pass
 * through. A different module exposing a selected symbol, selected precompiled Module input,
 * duplicate matching loads, missing exports and wrong signatures are refused.
 *
 * Both instantiate APIs are restored on success or failure. Constructors are not hooked;
 * bypassing both observed APIs cannot satisfy the required selected-instance load.
 * Positive controls at the real loader's call site must separately show it uses this instance.
 *
 * @param options - Exact original component bytes and explicitly selected export names.
 * @param options.moduleBytes - Original byte view, unchanged throughout the callback.
 * @param options.symbols - Nonempty, distinct frame-export names in counter order.
 * @param run - Exclusive loader/caller callback, given a fresh counter snapshot function.
 */
export const withWasmFrameEntryObserver = async ({ moduleBytes, symbols }, run) => {
	require(!observing, "frame observers need an exclusive realm");
	const input = bytesOf(moduleBytes);
	require(input !== null && input.length > 0, "component bytes are required");
	require(Array.isArray(symbols) && symbols.length > 0 && symbols.every(symbol => typeof symbol === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(symbol)) && new Set(symbols).size === symbols.length, "select distinct named frame exports");
	require(typeof run === "function", "a loader callback is required");
	const expected = input.slice(), selected = [...symbols], counts = selected.map(() => 0);
	require(WebAssembly.validate(expected), "component bytes must be a valid Wasm module");
	const descriptors = new Map(["instantiate", "instantiateStreaming"].filter(key => typeof WebAssembly[key] === "function").map(key => [key, Object.getOwnPropertyDescriptor(WebAssembly, key)]));
	const hooks = new Map();
	let matchingLoads = 0, loaded = false, failure = null;
	const guarded = async action => {
		try
		{ return await action(); }
		catch(error)
		{ failure ??= error; throw error; }
	};
	const observe = async (source, instantiate) => {
		require(source !== null, "precompiled Module input cannot authenticate component bytes");
		const matches = equal(source, expected);
		if(matches) require(++matchingLoads === 1, "component was instantiated more than once");
		const result = await instantiate();
		if(!matches)
		{
			require(selected.every(symbol => !Object.hasOwn(result.instance.exports, symbol)), "a different module exposes a selected frame export");
			return result;
		}
		require(equal(source, expected) && equal(input, expected), "component bytes changed during instantiation");
		const exports = Object.assign(Object.create(null), result.instance.exports);
		for(const [index, symbol] of selected.entries())
		{
			require(typeof exports[symbol] === "function", `missing frame export: ${symbol}`);
			exports[symbol] = wasmFrameEntry(exports[symbol], () => { counts[index]++; });
		}
		Object.freeze(exports);
		const instance = new Proxy(result.instance, { get: (target, key) => key === "exports" ? exports : Reflect.get(target, key, target) });
		loaded = true;
		return { ...result, instance };
	};
	try
	{
		observing = true;
		for(const [key, descriptor] of descriptors)
		{
			const native = descriptor.value;
			const hook = key === "instantiate"
				? (source, imports, ...options) => guarded(() => {
					// Node can lazily instantiate unrelated modules while setting up fetch.
					// Their bytes are irrelevant, but a selected module must never take this route.
					if(source instanceof WebAssembly.Module)
					{
						require(WebAssembly.Module.exports(source).every(item => !selected.includes(item.name)), "precompiled Module input cannot authenticate component bytes");
						return native.call(WebAssembly, source, imports, ...options);
					}
					return observe(bytesOf(source), () => native.call(WebAssembly, source, imports, ...options));
				})
				: (source, imports, ...options) => guarded(async () => {
					const response = await source;
					const bytes = new Uint8Array(await response.clone().arrayBuffer());
					return observe(bytes, () => native.call(WebAssembly, response, imports, ...options));
				});
			hooks.set(key, hook);
			Object.defineProperty(WebAssembly, key, { ...descriptor, value: hook });
		}
		const value = await run(() => [...counts]);
		if(failure) throw failure;
		require(loaded && matchingLoads === 1, "loader did not instantiate the selected component");
		require(equal(input, expected), "component bytes changed during observation");
		for(const [key, hook] of hooks) require(WebAssembly[key] === hook, "the observer hook was replaced");
		return { value, counts: [...counts] };
	}
	finally
	{
		for(const [key, descriptor] of descriptors) Object.defineProperty(WebAssembly, key, descriptor);
		observing = false;
	}
};

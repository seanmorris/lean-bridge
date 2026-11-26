/** Test only: read the real installed broker without modifying either Wasm image. */
export async function observeTariff(load) {
	const heaps = new Map(), saved = new Map();
	const observe = result => {
		const {exports} = result.instance ?? result;
		if (exports?.memory instanceof WebAssembly.Memory && typeof exports.bridge_owned_runtime_identities === "function")
			heaps.set(exports.memory, exports);
		return result;
	};
	try {
		for (const name of ["instantiate", "instantiateStreaming"]) {
			const original = WebAssembly[name];
			if (typeof original !== "function") continue;
			saved.set(name, original);
			WebAssembly[name] = async (...args) => observe(await Reflect.apply(original, WebAssembly, args));
		}
		const api = await load();
		if (heaps.size !== 1) throw new Error("Expected one installed ownership broker, got " + heaps.size);
		const [broker] = heaps.values();
		return {api, live: () => broker.bridge_owned_runtime_identities()};
	} finally {
		for (const [name, original] of saved) WebAssembly[name] = original;
	}
}

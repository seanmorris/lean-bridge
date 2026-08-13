import createMain from "../../../build/lean-link-spike/browser/main.mjs";
import { alphaBrowser as alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../../../poc/link-spike/loader.mjs";

let runtimePromise;
const mainWasm = new URL(
	"../../../build/lean-link-spike/browser/main.wasm",
	import.meta.url,
);
const alphaWasmName = decodeURIComponent(alpha.sideModule.pathname.split("/").at(-1));

const loadRuntime = () => {
	runtimePromise ??= createMain({
		locateFile:
			/**
       * Maps the requested runtime asset to the browser fixture URL used by the bundled consumer.
       *
       * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
       */
			function(path) {
				if(path === "main.wasm") return mainWasm.href;
				if(path === alphaWasmName) return alpha.sideModule.href;
				return path;
			}
	}).then(module => ({
		module
		, libraries: createLibraryLoader(module, { libraries: [alpha] })
	}));
	return runtimePromise;
};

/**
 * Runs native consumer and returns a structured result suitable for the browser consumer fixture.
 */
export const runNativeConsumer = async () => {
	const { module, libraries } = await loadRuntime();
	const api = await libraries.load(alpha);
	const box = new api.Box(42);
	const canonical = box.identity() === box;
	const value = box.read();
	box.dispose();
	const copied = api.roundTrip({
		enabled: false
		, count: 8
		, label: "browser λ"
		, bytes: new Uint8Array([0, 127, 255])
		, values: [1, 5, 13]
	});
	const result = Object.freeze({
		value
		, canonical
		, copied: {
			...copied,
			bytes: [...copied.bytes]
			, values: [...copied.values]
		}
		, runtimeInitializations: module._bridge_lean_runtime_init_runs()
	});
	return result;
};

/**
 * Link a freshly compiled owned side module against the production runtime.
 * Both component loads use their public loaders, without table access or test C.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../src/capsule/node.mjs";
import { createAlphaDescriptor } from "../../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../../poc/link-spike/loader.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Use prepared production bytes for the heap and legacy Alpha, and fresh typed
 * Lean carriers for the ownership component. No raw function-table resolution.
 *
 * @param options - Fixture objects, private descriptor and prepared runtime root.
 */
export const compileOwnedWasmPreparedHost = async options => {
	const { directory, run, objects, exports: symbols, component } = options;
	const prepared = resolve(options.preparedRoot, "lazy");
	await run("em++", [...objects.filter(name => name !== "broker").map(name => name + ".wasm.o")
		, "-O1", "-fwasm-exceptions", "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=" + symbols.join(",")
		, "-Wl,--no-entry", "-o", "owned.so.wasm"]);
	await saveLakeFile(directory, "prepared-loader.mjs", `import createMain from ${JSON.stringify(pathToFileURL(join(prepared, "main.mjs")).href)};
import { createComponentRuntime } from ${JSON.stringify(new URL("../../src/release/component-runtime.mjs", import.meta.url).href)};
export const module = await createMain();
export const cold = [module._bridge_lean_runtime_status(), module._bridge_lean_runtime_init_runs()];
export const runtime = await createComponentRuntime(async () => module, new URL(${JSON.stringify(pathToFileURL(join(prepared, "main.wasm")).href)}));
`);
	const { module, runtime, cold } = await import(pathToFileURL(join(directory, "prepared-loader.mjs")).href);
	assert.equal(module._bridge_owned_runtime_abi(), 1);
	assert.deepEqual(cold, [0, 0]);
	const libraries = createLibraryLoader(module);
	const legacy = createAlphaDescriptor({ sideModule: pathToFileURL(join(prepared, "alpha.so.wasm")) });
	const loadLegacy = () => libraries.load(legacy);
	if(options.alphaFirst) await loadLegacy();
	const descriptor = { id: component.layout.native.model.component.id
		, buildHash: component.metadataHash
		, integrity: sha256(await readFile(join(directory, "owned.so.wasm")))
		, initializer: component.privateAbi.initializer
		, sideModule: pathToFileURL(join(directory, "owned.so.wasm"))
		, privateAbi: component.privateAbi
		, bindingIr: component.layout.native.model.bindingIr };
	const pending = runtime.loadComponent(descriptor);
	assert.equal(runtime.loadComponent(descriptor), pending);
	const loadedComponent = await pending;
	const files = generateJavaScriptPackage(descriptor.bindingIr);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, `public/${path}`, source);
	await saveLakeFile(directory, "public/internal/runtime.mjs", `import { runtime as loader } from "../../prepared-loader.mjs";
const descriptor = ${JSON.stringify(descriptor)};
descriptor.sideModule = new URL(descriptor.sideModule);
export const runtime = await loader.loadComponent(descriptor);
`);
	const publicApi = await import(pathToFileURL(join(directory, "public/index.mjs")).href);
	return { module, runtime, descriptor, loadedComponent, loadLegacy, publicApi };
};

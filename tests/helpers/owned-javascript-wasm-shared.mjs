/**
 * Compile the actual browser runtime, then dynamically link owned and legacy
 * Lean side modules into its one heap. No replacement runtime controller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { emitValueFrameV1CHeader } from "../../src/abi/value-frame.mjs";
import { generateOwnedWasmBroker } from "../../src/backends/javascript/owned-wasm-broker.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { createComponentRuntime } from "../../src/release/component-runtime.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * The caller has freshly compiled Owned and its authenticated carriers.
 * Compile the existing Alpha/shim as an independent legacy module as well.
 *
 * @param options - Fresh component directory, pinned runtime, compiler and exports.
 */
export const compileOwnedWasmSharedHost = async options => {
	const { directory, root, sdk, run, objects, exports: componentExports, component, alphaFirst, publicLoader } = options;
	const broker = generateOwnedWasmBroker(), source = resolve("poc/lean-link-spike");
	const ir = JSON.parse(await readFile(join(source, "bindings/alpha.binding-ir.json"), "utf8"));
	await saveLakeFile(directory, "alpha_value_frame.generated.h", emitValueFrameV1CHeader(ir, "lean:Alpha.roundTrip", {
		abiVersion: 1, maxCopyBytes: 1024 * 1024, maxArrayLength: 64 * 1024
	}));
	const flags = ["-O1", "-fPIC", "-fwasm-exceptions", "-DLEAN_EMSCRIPTEN"
		, "-DBRIDGE_LEAN_OWNED_RUNTIME=1", "-DBRIDGE_LEAN_RUNTIME_TEST_HOOKS=1"
		, "-I", directory, "-I", join(root, "cmake/include")
		, "-I", join(root, "source/src")];
	for(const [name, extension] of [["main", "c"], ["component_scalar", "cpp"], ["runtime_lifecycle", "cpp"]])
		await run(extension === "cpp" ? "em++" : "emcc", [...flags, "-c", join(source, `${name}.${extension}`), "-o", `${name}.shared.o`]);
	const archives = ["lib/lean/libInit.a", "lib/lean/libleanrt.a", "libuv/src/libuv/libuv.a"].map(path => join(root, "cmake", path));
	const { stdout } = await processBuildRunner.capture({ command: join(sdk, "upstream/bin/llvm-nm")
		, args: ["--defined-only", "--extern-only", ...archives.slice(0, 2)]
		, cwd: directory, timeoutMs: 30000 });
	const leanExports = stdout.split("\n").flatMap(line => {
		const fields = line.trim().split(/\s+/u), name = fields.at(-1);
		return /^[TWBDRV]$/u.test(fields.at(-2)) && /^(?:lean_|l_|initialize_)/u.test(name) ? ["_" + name] : [];
	});
	const coreExports = ["dlsym", ...broker.supportExports
		, "bridge_lean_runtime_init"
		, "bridge_lean_runtime_status", "bridge_lean_runtime_init_runs"
		, "bridge_lean_runtime_shutdown", "bridge_lean_runtime_retire"
		, "bridge_lean_runtime_component_initialize"
		, "bridge_lean_component_initialize"
		, "bridge_lean_component_last_error", "bridge_lean_library_init_runs"
		, "bridge_test_lean_runtime_force_init_error"
		, "bridge_lean_alpha_make", "bridge_lean_alpha_read"
		, "bridge_lean_release", "bridge_lean_live_handles"
		, "bridge_register_lean_alpha", "bridge_scalar_call"
		, "bridge_scalar_frame_clear"
		, "bridge_scalar_frame_validate", "bridge_callable_store"
		, "bridge_callable_release", "bridge_component_runtime_can_shutdown"
		, ...broker.exports];
	const exports = [...new Set([...leanExports, ...coreExports.map(name => "_" + name)])].sort();
	await saveLakeFile(directory, "shared-exports.json", JSON.stringify(exports));
	await run("em++", ["main.shared.o", "component_scalar.shared.o"
		, "runtime_lifecycle.shared.o", "broker.wasm.o"
		, "-Wl,--start-group", ...archives, "-Wl,--end-group"
		, "-O1", "-fwasm-exceptions", "-sMAIN_MODULE=2", "-sMODULARIZE=1"
		, "-sASSERTIONS=1"
		, "-sEXPORT_ES6=1", "-sENVIRONMENT=node", "-sALLOW_MEMORY_GROWTH=1"
		, "-sSTACK_SIZE=4194304"
		, "-sEXPORTED_RUNTIME_METHODS=HEAP8,FS,loadDynamicLibrary,wasmTable"
		, "-sEXPORTED_FUNCTIONS=@shared-exports.json", "-Wl,--no-entry"
		, "-o", "shared.mjs"]);
	await run("em++", [...objects.filter(name => name !== "broker").map(name => name + ".wasm.o")
		, "-O1", "-fwasm-exceptions", "-sSIDE_MODULE=2"
		, "-sEXPORTED_FUNCTIONS=" + componentExports.join(",")
		, "-Wl,--no-entry", "-o", "owned.so.wasm"]);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	await saveLakeFile(directory, "Alpha.lean", await readFile(join(source, "Alpha.lean")));
	await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
		, args: ["-c", "Alpha.c", "Alpha.lean"], cwd: directory
		, env: { ...process.env, LEAN_PATH: directory }, timeoutMs: 180000 });
	await run("emcc", [...flags, "Alpha.c", join(source, "alpha_shim.c")
		, "-sSIDE_MODULE=2", "-Wl,--no-entry", "-o", "legacy.so.wasm"]);
	const create = (await import(pathToFileURL(join(directory, "shared.mjs")).href)).default;
	const module = await create();
	assert.equal(module._bridge_owned_runtime_abi(), 1);
	assert.equal(module._bridge_lean_runtime_status(), 0);
	assert.equal(module._bridge_lean_runtime_init_runs(), 0);
	const symbol = (name, action) => {
		const bytes = new TextEncoder().encode(name + "\0"), pointer = module._malloc(bytes.length);
		assert.ok(pointer); module.HEAP8.set(bytes, pointer);
		let trapped = false;
		try
		{ return action(pointer); }
		catch(error)
		{ trapped = true; throw error; }
		finally
		{ if(!trapped && [0, 2].includes(module._bridge_lean_runtime_status())) module._free(pointer); }
	};
	const link = async name => {
		module.FS.writeFile("/" + name, await readFile(join(directory, name)));
		try
		{ await module.loadDynamicLibrary("/" + name, { global: true, loadAsync: true, nodelete: true }); }
		finally
		{ module.FS.unlink("/" + name); }
	};
	let legacyLoaded = false;
	const loadLegacy = async () => {
		if(legacyLoaded) return;
		await link("legacy.so.wasm");
		if(module._bridge_lean_runtime_status() === 0) assert.equal(module._bridge_lean_runtime_init(), 1);
		else assert.equal(module._bridge_lean_runtime_status(), 2);
		legacyLoaded = true;
	};
	if(alphaFirst) await loadLegacy();
	let runtime, descriptor, loadedComponent;
	if(publicLoader)
	{
		runtime = await createComponentRuntime(async () => module, pathToFileURL(join(directory, "shared.wasm")));
		descriptor = { id: component.layout.native.model.component.id
			, buildHash: component.metadataHash
			, integrity: sha256(await readFile(join(directory, "owned.so.wasm")))
			, initializer: component.privateAbi.initializer
			, sideModule: pathToFileURL(join(directory, "owned.so.wasm"))
			, privateAbi: component.privateAbi
			, bindingIr: component.layout.native.model.bindingIr };
		const pending = runtime.loadComponent(descriptor);
		assert.equal(runtime.loadComponent(descriptor), pending);
		loadedComponent = await pending;
	}
	else await link("owned.so.wasm");
	for(const name of componentExports)
	{
		const index = symbol(name.slice(1), pointer => module._dlsym(0, pointer));
		assert.ok(index, `Shared runtime did not resolve ${name}`);
		module[name] = module.wasmTable.get(index);
	}
	const operation = frame => symbol(component.controlSymbol, pointer => module._bridge_scalar_call(pointer, frame));
	return { module, operation, loadLegacy, runtime, descriptor, loadedComponent };
};

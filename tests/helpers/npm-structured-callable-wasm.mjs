/**
 * Compile isolated callback probes in a real Lean/Wasm heap. Instrumentation
 * counts copied output owners and JavaScript allocations, not Lean heap objects.
 * Original installed npm archives never use these hooks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { descriptor, sourceExports } from "./npm-structured-callable-fixture.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { componentStructuredCallableLeanSource } from "../../src/build/component-structured-callable-lean.mjs";
import { generateComponentStructuredCallableAdapters } from "../../src/build/component-structured-callable-adapters.mjs";
import { componentCallableLeanPrelude, createComponentPrivateAbi, generateComponentCallableAdapters } from "../../src/build/component-callable-adapters.mjs";
import { createComponentCallableRuntime } from "../../src/release/component-callable-runtime.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Compile both callback frame versions and reuse the binary in isolated heaps.
 *
 * @param directory - Test-owned temporary build directory.
 */
export const compileStructuredCallableWasm = async directory => {
	const ir = structuredCallableReviewedIr({ recursive: true }), abi = descriptor(ir);
	const scalarIr = callableReviewedIr([
		{ name: "Callables.callUInt32", parameters: ["uint32", { callback: { parameters: ["uint32"], result: "uint32" } }], result: "uint32" }
		, { name: "Callables.makeUInt32", parameters: ["uint32"], result: { callback: { parameters: ["bool", "uint32"], result: "uint32" } } }
	]);
	const scalarAbi = createComponentPrivateAbi(scalarIr);
	assert.equal(scalarAbi.version, 3);
	const closure = scalarAbi.callbacks.find(item => item.parameters.length === 2);
	const scalarSource = [
		...componentCallableLeanPrelude(scalarAbi, type => type.name === "bool" ? "Bool" : "UInt32")
		, `@[export ${scalarAbi.exports[0].symbol}_lean]`
		, "def scalarCall (value : UInt32) (callback : UInt32 → UInt32) := Callables.callUInt32 value callback"
		, `@[export ${scalarAbi.exports[1].symbol}_lean]`
		, `def scalarMake (value : UInt32) : ClosureCarry${closure.key} := ⟨Callables.makeUInt32 value⟩`
	];
	const source = [
		await readFile("tests/fixtures/onboarding/structured-callables/Structured.lean", "utf8")
		, await readFile("tests/fixtures/onboarding/callables/Callables.lean", "utf8")
		, "namespace NpmStructuredTransport"
		, ...componentStructuredCallableLeanSource(abi, sourceExports(ir, abi))
		, "namespace Primitive", ...scalarSource, "end Primitive"
		, "end NpmStructuredTransport", ""
	].join("\n");
	const hooks = await readFile("tests/fixtures/structured-types/recursive-ownership.c", "utf8");
	const dispatchHooks = await readFile("tests/fixtures/structured-callable-consumers/npm-dispatch-probe.c", "utf8");
	const generated = generateComponentStructuredCallableAdapters(abi);
	await writeFile(join(directory, "NpmStructuredTransport.lean"), source);
	await writeFile(join(directory, "StructuredBridge.c"), `${hooks}\n${dispatchHooks}\n${generated}`);
	await writeFile(join(directory, "PrimitiveBridge.c"), generateComponentCallableAdapters(scalarAbi));
	const capture = async (command, args) => processBuildRunner.capture({ command, args, cwd: directory, timeoutMs: 180_000 }).catch(error => {
		throw new Error(JSON.stringify(error.details ?? error.message), { cause: error });
	});
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	await capture(lean, ["-o", "NpmStructuredTransport.olean", "-c", "NpmStructuredTransport.c", "NpmStructuredTransport.lean"]);
	const lock = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json"));
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const runtimeSource = resolve(process.env.LEAN_BRIDGE_RUNTIME_ROOT ?? `build/lean-runtime/${lock.runtime.leanCommit}-${lock.runtime.patchSetSha256}-browser`);
	await capture(process.env.LEAN_BRIDGE_EMCC ?? resolve(".toolchains/emsdk/upstream/emscripten/emcc"), [
		"-O2", "-fwasm-exceptions", "-flto", "-fPIC", "-ffp-contract=off"
		, "-DLEAN_EMSCRIPTEN", "-UNDEBUG", "-sSIDE_MODULE=2", "-Wl,--no-entry"
		, "-Wl,--export=initialize_NpmStructuredTransport"
		, ...[...abi.exports, ...scalarAbi.exports].map(item => `-Wl,--export=${item.symbol}`)
		, ...["configure", "live", "attempts", "decodes", "release"].map(name => `-Wl,--export=recursive_test_${name}`)
		, "-Wl,--export=structured_test_reply"
		, "-Wl,--export=structured_test_dispatches"
		, `-I${join(runtimeSource, "cmake/include")}`
		, `-I${join(runtimeSource, "source/src/include")}`
		, `-I${resolve("poc/lean-link-spike")}`, "NpmStructuredTransport.c"
		, "StructuredBridge.c", "PrimitiveBridge.c", "-o", "structured.wasm"
	]);
	const binary = await readFile(join(directory, "structured.wasm"));
	const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
	const runtimeSha256 = sha256(await readFile(join(runtimeRoot, "main.wasm")));
	return { abi, scalarAbi, binarySha256: sha256(binary)
		, sourceSha256: sha256(source), generatedAdapterSha256: sha256(generated)
		, runtimeSha256
		, instantiate: async () => {
			const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
			assert.equal(module._bridge_lean_runtime_init(), 1);
			module.FS.writeFile("/structured.wasm", binary);
			await module.loadDynamicLibrary("/structured.wasm", { global: true, loadAsync: true, nodelete: true });
			module.FS.unlink("/structured.wasm");
			const malloc = module._malloc, free = module._free;
			let runtime;
			const text = (value, operation, probe = false) => {
				const bytes = new TextEncoder().encode(`${value}\0`), pointer = (probe ? malloc : module._malloc)(bytes.length);
				if(!pointer) return null;
				try
				{ module.HEAP8.set(bytes, pointer); return operation(pointer); }
				finally
				{
					let available = true;
					if(!probe)
					{
						try
						{ runtime?.assertOpen(); }
						catch
						{ available = false; }
					}
					if(available) (probe ? free : module._free)(pointer);
				}
			};
			assert.equal(text("initialize_NpmStructuredTransport", pointer => module._bridge_lean_component_initialize(pointer), true), 1);
			const live = new Set();
			module._malloc = size => {
				const pointer = malloc(size);
				if(pointer)
				{ assert.ok(!live.has(pointer)); live.add(pointer); }
				return pointer;
			};
			module._free = pointer => { assert.ok(live.delete(pointer), `Unknown/double JS free ${pointer}`); free(pointer); };
			const nativeCall = (symbol, frame, probe = false) => {
				const status = text(symbol, pointer => module._bridge_scalar_call(pointer, frame), probe);
				if(status === null)
				{ new DataView(module.HEAP8.buffer).setUint32(frame + 8, 5, true); return 5; }
				return status;
			};
			const command = (name, failure = 0, enabled = 1) => {
				// Probe controls are not production allocations and cannot themselves
				// participate in the JavaScript fault counter.
				const frame = malloc(48); assert.ok(frame);
				try
				{
					module.HEAP8.fill(0, frame, frame + 48);
					const view = new DataView(module.HEAP8.buffer);
					view.setUint32(frame + 36, enabled, true); view.setUint32(frame + 40, failure, true);
					return nativeCall(name, frame, true);
				} finally
				{ free(frame); }
			};
			module._bridge_recursive_frame_clear = frame => nativeCall("recursive_test_release", frame, true);
			runtime = createComponentCallableRuntime(module);
			const bind = descriptor => runtime.bind(descriptor, new Map(descriptor.exports.map(item => [item.bindingId, frame => nativeCall(item.symbol, frame)])));
			const api = bind(abi), scalar = bind(scalarAbi);
			const clean = () => { assert.equal(live.size, 0); runtime.assertOpen(); assert.equal(command("recursive_test_live"), 0); };
			command("recursive_test_configure");
			return { module, runtime, abi, scalarAbi, bind, command, clean, nativeCall
				, call: (name, ...args) => api.call(`lean:Structured.${name}`, args)
				, scalar: (name, ...args) => scalar.call(`lean:Callables.${name}`, args)
				, allocations: () => live.size };
		}
	};
};

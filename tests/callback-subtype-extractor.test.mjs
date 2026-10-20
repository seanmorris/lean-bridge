/**
 * Fresh Lean owns callback Subtype direction and every consumed constructor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { callbackSubtypeDirection } from "../src/abi/refinements.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../src/analyze/semantic-model.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { generateComponentStructuredCallableAdapters } from "../src/build/component-structured-callable-adapters.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { createComponentCallableRuntime } from "../src/release/component-callable-runtime.mjs";

const enabled = process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_EXTRACTOR_TEST === "1";
const wasm = process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_WASM_TEST === "1";
const copy = refinement => ({ ownership: "copy", lifetime: null, ...refinement ? { refinement } : {} });
const constructor = { constructor: "CallbackSubtypes.checkedPositive" };
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const host = { ownership: "borrow", lifetime: { scope: "call", anchor: null }
	, callable: { parameters: [copy()], result: copy(constructor) } };
const closure = {
	ownership: "lease"
	, lifetime: { scope: "explicit", anchor: null }
	, callable: { parameters: [copy(constructor)], result: copy() }
};
const contracts = {
	"CallbackSubtypes.callHost": { parameters: [host] }
	, "CallbackSubtypes.makeClosure": { parameters: [copy()], result: closure }
	, "CallbackSubtypes.callHostContainer": { parameters: [{ ...host
		, callable: { parameters: [copy()], result: copy(tree("result", tree("option", constructor), null)) } }] }
	, "CallbackSubtypes.makeContainerClosure": {
		parameters: [copy()]
		, result: { ...closure
			, callable: { parameters: [copy(tree("array", tree("option", constructor)))], result: copy() } }
	}
};

test("fresh Lean extracts opposite callback Subtype directions", { skip: !enabled, timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-subtype-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const source = "tests/fixtures/onboarding/callback-subtypes/CallbackSubtypes.lean";
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean");
	const environment = { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` };
	const run = async args => {
		try
		{ return await promisify(execFile)(lean, args, { cwd: directory, env: environment, maxBuffer: 16 * 1024 * 1024, signal: t.signal }); }
		catch(error)
		{
			error.message += `\nstdout:\n${error.stdout ?? ""}\nstderr:\n${error.stderr ?? ""}`;
			throw error;
		}
	};
	await cp(source, join(directory, "CallbackSubtypes.lean"));
	await run(["-o", "CallbackSubtypes.olean", "CallbackSubtypes.lean"]);
	const identity = await identifyLeanInterface(join(directory, "CallbackSubtypes.olean"));
	const module = { name: "CallbackSubtypes", sourcePath: "CallbackSubtypes.lean"
		, sourceSha256: sha256(await readFile(source))
		, interfaceSha256: identity.interfaceSha256 };
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules: [module] };
	const selection = {
		profile: "native-library-v1"
		, modules: [module.name]
		, exportModules: [module.name]
		, exports: Object.keys(contracts)
		, resources: []
		, arities: [["CallbackSubtypes.makeClosure", 1], ["CallbackSubtypes.makeContainerClosure", 1]]
		, contracts
	};
	const request = createMetadataRequest(selection, context), requestPath = join(directory, "request.json");
	await writeFile(requestPath, canonicalJson(request));
	const output = await run(["--run", extractor, "--metadata", requestPath]);
	assert.equal(output.stderr, "");
	const report = JSON.parse(output.stdout);
	validateElaboratedMetadata(report, request);
	const projections = new Map(report.modules[0].declarations.filter(item => item.selected).map(item => [item.identity, item.projection]));
	const hostType = projections.get("CallbackSubtypes.callHost").parameters[0].type;
	const closureType = projections.get("CallbackSubtypes.makeClosure").result;
	assert.deepEqual(hostType.parameters[0].predicate, { kind: "subtype", constructor: null });
	assert.deepEqual(hostType.result.predicate, { kind: "subtype", constructor: constructor.constructor });
	assert.deepEqual(closureType.parameters[0].predicate, { kind: "subtype", constructor: constructor.constructor });
	assert.deepEqual(closureType.result.predicate, { kind: "subtype", constructor: null });
	const hostContainer = projections.get("CallbackSubtypes.callHostContainer").parameters[0].type;
	assert.equal(hostContainer.parameters[0].element.predicate.constructor, null);
	assert.equal(hostContainer.result.arguments[0].element.predicate.constructor, constructor.constructor);
	const closureContainer = projections.get("CallbackSubtypes.makeContainerClosure").result;
	assert.equal(closureContainer.parameters[0].element.element.predicate.constructor, constructor.constructor);
	assert.equal(closureContainer.result.element.predicate.constructor, null);
	const semantic = createElaboratedSemanticModel({ metadata: report, request
		, component: { id: "callback-subtypes@1.0.0", name: "callback-subtypes", version: "1.0.0" }
		, elaborationSha256: sha256(output.stdout) });
	const callbacks = semantic.document.types.filter(type => type.kind === "callback");
	assert.equal(callbacks.length, 4);
	assert.deepEqual(callbacks.map(type => callbackSubtypeDirection({
		parameters: type.callable.parameters.map(parameter => parameter.type)
		, result: type.callable.result.type
	}, type.source.extensions["lean-lang.org/refinements"], semantic.document.types)).sort(), ["closure", "closure", "host", "host"]);
	assert.equal(new Set(callbacks.map(type => type.id)).size, callbacks.length);
	for(const mutate of [
		value => { value.parameters[0].predicate.constructor = constructor.constructor; }
		, value => { value.result.predicate.constructor = null; }
		, value => { value.result.predicate.constructor = "CallbackSubtypes.missing"; }
	]) {
		const changed = structuredClone(report), type = changed.modules[0].declarations.find(item => item.identity === "CallbackSubtypes.callHost").projection.parameters[0].type;
		mutate(type);
		assert.throws(() => validateElaboratedMetadata(changed, request), /configured export contract|invalid Subtype refinement/u);
	}
	const packageFiles = generateJavaScriptPackage(semantic.document);
	assert.match(packageFiles["index.mjs"], /export function withRecovery\(operation, recovery\)/u);
	assert.match(packageFiles["index.mjs"], /runtime\.prepareCallback/u);
	assert.match(packageFiles["index.d.ts"], /withRecovery<Args extends readonly unknown\[\], Result>/u);
	assert.match(packageFiles["binding-manifest.json"], /"withRecovery"/u);
	const generated = generateCompilerAdapters({
		analysis: {
			bindingIr: { origin: "lean-elaborated", document: semantic.document, semanticSha256: sha256(canonicalJson(semantic.document)) }
			, exportCandidates: semantic.document.declarations.map(item => ({
				declaration: item.source.declaration
				, sourceModule: module.name
				, status: "exportable"
			}))
		}
		, componentPlan: { sha256: "0".repeat(64), document: { bindingIr: { semanticSha256: sha256(canonicalJson(semantic.document)) } } }
	});
	const adapter = generated.files["LeanBridgeGenerated.lean"];
	assert.match(adapter, /checkedPositive _bridgeRecoveryRaw/u);
	assert.match(adapter, /\.val/u);
	assert.doesNotMatch(adapter, /axiom|unsafeCast|sorry|panic!/u);
	await writeFile(join(directory, "LeanBridgeGenerated.lean"), adapter);
	try
	{ await run(["-o", "LeanBridgeGenerated.olean", "LeanBridgeGenerated.lean"]); }
	catch(error)
	{
		error.message += `\ngenerated source:\n${adapter.split("\n").map((line, index) => `${index + 1}: ${line}`).join("\n")}`;
		throw error;
	}
	const c = generateComponentStructuredCallableAdapters(generated.plan.privateAbi, generated.plan.exports);
	assert.match(c, /_recovery\(size_t token\)/u);
	assert.match(c, /frame->status = status \? status : 10/u);
	assert.match(c, /_reject\(size_t token, lean_object \*recovery\)/u);
	if(wasm)
	{
		for(const name of ["LEAN_BRIDGE_LAKE_RUNTIME_ROOT", "LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_EMCC"])
			assert.ok(process.env[name], `${name} is required for the callback Subtype Wasm test`);
		await run(["-c", "CallbackSubtypes.c", "CallbackSubtypes.lean"]);
		await run(["-c", "LeanBridgeGenerated.c", "LeanBridgeGenerated.lean"]);
		await writeFile(join(directory, "CallbackSubtypeBridge.c"), c);
		const execute = async (command, args) => {
			try
			{ return await promisify(execFile)(command, args, { cwd: directory, env: process.env, maxBuffer: 16 * 1024 * 1024, signal: t.signal }); }
			catch(error)
			{
				error.message += `\nstdout:\n${error.stdout ?? ""}\nstderr:\n${error.stderr ?? ""}`;
				throw error;
			}
		};
		await execute(resolve(process.env.LEAN_BRIDGE_EMCC), [
			"-O2", "-fwasm-exceptions", "-flto", "-fPIC", "-ffp-contract=off"
			, "-DLEAN_EMSCRIPTEN", "-UNDEBUG", "-sSIDE_MODULE=2", "-Wl,--no-entry"
			, "-Wl,--export=initialize_LeanBridgeGenerated"
			, ...generated.plan.privateAbi.exports.map(item => `-Wl,--export=${item.symbol}`)
			, `-I${join(resolve(process.env.LEAN_BRIDGE_RUNTIME_ROOT), "cmake/include")}`
			, `-I${join(resolve(process.env.LEAN_BRIDGE_RUNTIME_ROOT), "source/src/include")}`
			, `-I${resolve("poc/lean-link-spike")}`
			, "CallbackSubtypes.c"
			, "LeanBridgeGenerated.c"
			, "CallbackSubtypeBridge.c"
			, "-o"
			, "callback-subtypes.wasm"
		]);
		const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT);
		const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
		const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
		assert.equal(module._bridge_lean_runtime_init(), 1);
		module.FS.writeFile("/callback-subtypes.wasm", await readFile(join(directory, "callback-subtypes.wasm")));
		await module.loadDynamicLibrary("/callback-subtypes.wasm", { global: true, loadAsync: true, nodelete: true });
		module.FS.unlink("/callback-subtypes.wasm");
		const text = (value, operation) => {
			const bytes = new TextEncoder().encode(`${value}\0`), pointer = module._malloc(bytes.length);
			assert.ok(pointer); module.HEAP8.set(bytes, pointer);
			try
			{ return operation(pointer); }
			finally
			{ module._free(pointer); }
		};
		assert.equal(text("initialize_LeanBridgeGenerated", pointer => module._bridge_lean_component_initialize(pointer)), 1);
		const runtime = createComponentCallableRuntime(module);
		const api = runtime.bind(generated.plan.privateAbi, new Map(generated.plan.privateAbi.exports.map(item => [item.bindingId
			, frame => text(item.symbol, pointer => module._bridge_scalar_call(pointer, frame))])));
		const call = (name, ...args) => api.call(`lean:CallbackSubtypes.${name}`, args);
		let calls = 0;
		assert.equal(call("callHost", api.withRecovery(value => { calls++; return value + 1n; }, 1n)), 2n);
		assert.equal(calls, 1);
		calls = 0;
		assert.throws(() => call("callHost", value => { calls++; return value; }), /requires withRecovery/u);
		assert.equal(calls, 0);
		assert.throws(() => call("callHost", api.withRecovery(value => { calls++; return value; }, 0n)), /failed \(5\)/u);
		assert.equal(calls, 0);
		calls = 0;
		assert.throws(() => call("callHost", api.withRecovery(() => { calls++; return 0n; }, 1n)), /failed \(5\)/u);
		assert.equal(calls, 1);
		const original = new Error("host callback failed");
		assert.throws(() => call("callHost", api.withRecovery(() => { throw original; }, 1n)), error => error === original);
		assert.equal(call("callHost", api.withRecovery(value => value, 1n)), 1n);
		const closure = call("makeClosure", 9n);
		assert.equal(closure(2n), 2n);
		assert.throws(() => closure(0n), /failed \(5\)/u);
		assert.equal(closure(3n), 3n);
		assert.equal(closure.dispose(), true);
		assert.equal(call("callHostContainer", api.withRecovery(() => ({ ok: { tag: "some", value: 2n } }), { ok: { tag: "some", value: 1n } })).ok.value, 2n);
		const container = call("makeContainerClosure", 0n);
		assert.deepEqual(container([{ tag: "none" }]), { tag: "none" });
		assert.throws(() => container([{ tag: "some", value: 0n }]), /failed \(5\)/u);
		assert.deepEqual(container([]), { tag: "none" });
		container.dispose();
		runtime.assertOpen();
	}
});

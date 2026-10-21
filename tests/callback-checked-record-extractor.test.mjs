/**
 * Fresh Lean owns the checked-record direction at every callback site and
 * every consumed constructor; the structured callable adapter mirrors each
 * record on the wire and runs its constructor only where the host produces it.
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
import { reviewedSubtypeContracts } from "../src/analyze/reviewed-subtypes.mjs";
import { createElaboratedSemanticModel } from "../src/analyze/semantic-model.mjs";
import { componentStructuredCallableAbi } from "../src/abi/component-structured-callables.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { generateComponentStructuredCallableAdapters } from "../src/build/component-structured-callable-adapters.mjs";
import { createComponentCallableRuntime } from "../src/release/component-callable-runtime.mjs";
import { checkCallbackCheckedRecords } from "./fixtures/callback-checked-record-consumers/javascript.mjs";
import {
	callbackCheckedRecordArities, callbackCheckedRecordContracts as contracts, callbackCheckedRecordExpected
	, callbackCheckedRecordFixture, callbackCheckedRecordInterval, callbackCheckedRecordModule
	, callbackCheckedRecordReviewedIr, callbackCheckedRecordWeighted
} from "./helpers/callback-checked-record-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_EXTRACTOR_TEST === "1";
const wasm = process.env.LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_WASM_TEST === "1";
const module = callbackCheckedRecordModule;
const qualified = name => `${module}.${name}`;
const key = "lean-lang.org/refinements";

test("fresh Lean extracts opposite callback checked-record directions", { skip: !enabled, timeout: 300_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-checked-record-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const source = `${callbackCheckedRecordFixture}/${module}.lean`;
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
	await cp(source, join(directory, `${module}.lean`));
	await run(["-o", `${module}.olean`, `${module}.lean`]);
	const identity = await identifyLeanInterface(join(directory, `${module}.olean`));
	const moduleIdentity = { name: module, sourcePath: `${module}.lean`
		, sourceSha256: sha256(await readFile(source))
		, interfaceSha256: identity.interfaceSha256 };
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules: [moduleIdentity] };
	const selection = {
		profile: "native-library-v1"
		, modules: [module]
		, exportModules: [module]
		, exports: Object.keys(contracts)
		, resources: []
		, arities: Object.entries(callbackCheckedRecordArities)
		, contracts
	};
	const request = createMetadataRequest(selection, context), requestPath = join(directory, "request.json");
	await writeFile(requestPath, canonicalJson(request));
	const output = await run(["--run", extractor, "--metadata", requestPath]);
	assert.equal(output.stderr, "");
	const report = JSON.parse(output.stdout);
	validateElaboratedMetadata(report, request);
	const declarations = report.modules[0].declarations.filter(item => item.selected);
	assert.deepEqual(declarations.map(item => item.projection.status), Object.keys(contracts).map(() => "supported"));
	const projections = new Map(declarations.map(item => [item.identity, item.projection]));
	const record = (type, name) => {
		assert.equal(type.kind, "record"); assert.equal(type.name, qualified(name)); assert.ok(Array.isArray(type.erased) && type.erased.length);
		return type;
	};
	const checked = (type, name, constructor) => {
		assert.equal(type.kind, "refinement");
		assert.deepEqual(type.predicate, { kind: "checked-record", constructor: qualified(constructor) });
		return record(type.base, name);
	};
	// A host callback: Lean produces the bare argument, the host reply names the constructor.
	const hostType = projections.get(qualified("callHost")).parameters[0].type;
	record(hostType.parameters[0], "Interval");
	checked(hostType.result, "Interval", "mkInterval");
	// A leased closure: the host-produced argument names the constructor, Lean produces the result.
	const closureType = projections.get(qualified("makeClosure")).result;
	checked(closureType.parameters[0], "Interval", "mkInterval");
	assert.deepEqual(closureType.result, { kind: "primitive", name: "nat", lean: "Nat", abi: closureType.result.abi });
	const mixedClosure = projections.get(qualified("makeMixedClosure")).result;
	assert.equal(mixedClosure.parameters[0].kind, "primitive");
	checked(mixedClosure.parameters[1], "Interval", "mkInterval");
	record(mixedClosure.result, "Interval");
	// Structural containers keep the direction.
	const hostContainer = projections.get(qualified("callHostContainer")).parameters[0].type;
	record(hostContainer.parameters[0].element, "Interval");
	checked(hostContainer.result.arguments[0].element, "Interval", "mkInterval");
	const closureContainer = projections.get(qualified("makeContainerClosure")).result;
	checked(closureContainer.parameters[0].element.element, "Interval", "mkInterval");
	record(closureContainer.result.element, "Interval");
	// A Subtype payload field runs first at a host-produced site and projects at a Lean-produced one.
	const nestedType = projections.get(qualified("callHostNested")).parameters[0].type;
	const producedWeighted = record(nestedType.parameters[0], "Weighted");
	assert.deepEqual(producedWeighted.fields[0].type.predicate, { kind: "subtype", constructor: null });
	const consumedWeighted = checked(nestedType.result, "Weighted", "mkWeighted");
	assert.deepEqual(consumedWeighted.fields[0].type.predicate, { kind: "subtype", constructor: qualified("checkedPositive") });
	const closureNested = projections.get(qualified("makeNestedClosure")).result;
	assert.deepEqual(checked(closureNested.parameters[0], "Weighted", "mkWeighted").fields[0].type.predicate
		, { kind: "subtype", constructor: qualified("checkedPositive") });

	const semantic = createElaboratedSemanticModel({ metadata: report, request
		, component: { id: "callback-checked-records@1.0.0", name: "callback-checked-records", version: "1.0.0" }
		, elaborationSha256: sha256(output.stdout) });
	const callbacks = semantic.document.types.filter(type => type.kind === "callback");
	assert.equal(callbacks.length, 8);
	assert.equal(new Set(callbacks.map(type => type.id)).size, callbacks.length);
	const direction = type => callbackSubtypeDirection({
		parameters: type.callable.parameters.map(parameter => parameter.type)
		, result: type.callable.result.type
	}, type.source.extensions[key], semantic.document.types);
	assert.deepEqual(callbacks.map(direction).sort(), ["closure", "closure", "closure", "closure", "host", "host", "host", "host"]);
	const byExport = name => {
		const declaration = semantic.document.declarations.find(item => item.source.declaration === qualified(name));
		const site = name.startsWith("call") ? declaration.parameters[0] : declaration.result;
		return semantic.document.types.find(type => type.id === site.type.id);
	};
	// Every callback site keeps the exact field form: a Lean-produced record projects with
	// a null constructor, a host-produced one names its constructor.
	const interval = structuredClone(callbackCheckedRecordInterval);
	const projectedInterval = { ...structuredClone(callbackCheckedRecordInterval), constructor: null };
	assert.deepEqual(byExport("callHost").source.extensions[key], { parameters: [projectedInterval], result: interval });
	assert.deepEqual(byExport("makeClosure").source.extensions[key], { parameters: [interval], result: null });
	assert.deepEqual(byExport("makeMixedClosure").source.extensions[key], { parameters: [null, interval], result: projectedInterval });
	assert.deepEqual(byExport("callHostContainer").source.extensions[key]
		, { parameters: [{ kind: "option", arguments: [projectedInterval] }], result: { kind: "result", arguments: [{ kind: "option", arguments: [interval] }, null] } });
	assert.deepEqual(byExport("makeContainerClosure").source.extensions[key], {
		parameters: [{ kind: "array", arguments: [{ kind: "option", arguments: [interval] }] }]
		, result: { kind: "option", arguments: [projectedInterval] }
	});
	const weighted = {
		kind: "checked-record", name: qualified("Weighted")
		, constructor: qualified("mkWeighted")
		, fields: [
			{ name: "weight"
				, refinement: { kind: "subtype", constructor: qualified("checkedPositive") } }
			, { name: "limit", refinement: null }
		]
	};
	const projectedWeighted = { ...structuredClone(weighted), constructor: null
		, fields: [{ name: "weight", refinement: { kind: "subtype", constructor: null } }, { name: "limit", refinement: null }] };
	assert.deepEqual(byExport("callHostNested").source.extensions[key], { parameters: [projectedWeighted], result: weighted });
	assert.deepEqual(byExport("makeNestedClosure").source.extensions[key], { parameters: [weighted], result: null });
	void callbackCheckedRecordWeighted;

	// An independent review of the same callbacks derives exactly the compiler contracts.
	const reviewed = callbackCheckedRecordReviewedIr(semantic.document);
	assert.deepEqual(reviewedSubtypeContracts(reviewed), contracts);

	// Mutation controls: the compiler report cannot move a constructor across the direction.
	const refused = /configured export contract|Invalid checked record refinement|invalid checked record constructor|Unsupported nested refinement position|Invalid Subtype refinement|invalid Subtype refinement|checked records require a structural/u;
	for(const [name, mutate, pattern] of [
		["callHost", type => { type.result.predicate.constructor = null; }, refused]
		, ["callHost", type => { type.parameters[0] = { kind: "refinement", base: type.parameters[0], predicate: { kind: "checked-record", constructor: qualified("mkInterval") }, abi: type.parameters[0].abi }; }, refused]
		, ["callHost", type => { type.result.predicate.constructor = qualified("missing"); }, refused]
		, ["callHostNested", type => { type.result.base.fields[0].type.predicate.constructor = null; }, refused]
		, ["callHostNested", type => { type.parameters[0].fields[0].type.predicate.constructor = qualified("checkedPositive"); }, refused]
	]) {
		const changed = structuredClone(report);
		mutate(changed.modules[0].declarations.find(item => item.identity === qualified(name)).projection.parameters[0].type);
		assert.throws(() => validateElaboratedMetadata(changed, request), pattern, name);
	}

	// The structured callable adapter carries every checked record as its erased payload
	// mirror: a host reply and a closure argument run the record constructor (a nested
	// Subtype field first), a Lean-produced record is erased, and a rejected reply falls
	// back to the recovery value the same constructor accepted before the call.
	const packageFiles = generateJavaScriptPackage(semantic.document);
	assert.match(packageFiles["index.mjs"], /export function withRecovery\(operation, recovery\)/u);
	assert.match(packageFiles["index.mjs"], /runtime\.prepareCallback/u);
	assert.match(packageFiles["index.d.ts"], /export interface Interval \{/u);
	assert.match(packageFiles["index.d.ts"], /export interface Weighted \{/u);
	assert.match(packageFiles["internal/validators.mjs"], /if \(refinement === null \|\| refinement\.kind === 'subtype'\) return;/u);
	const generated = generateCompilerAdapters({
		analysis: {
			bindingIr: { origin: "lean-elaborated", document: semantic.document, semanticSha256: sha256(canonicalJson(semantic.document)) }
			, exportCandidates: semantic.document.declarations.map(item => ({
				declaration: item.source.declaration
				, sourceModule: module
				, status: "exportable"
			}))
		}
		, componentPlan: { sha256: "0".repeat(64), document: { bindingIr: { semanticSha256: sha256(canonicalJson(semantic.document)) } } }
	});
	assert.equal(generated.plan.privateAbi.version, componentStructuredCallableAbi);
	// Adapter mutation controls: a direction moved on any callback site is refused before
	// any mirror or constructor is generated.
	const generate = document => generateCompilerAdapters({
		analysis: {
			bindingIr: { origin: "lean-elaborated", document, semanticSha256: sha256(canonicalJson(document)) }
			, exportCandidates: document.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: module, status: "exportable" }))
		}
		, componentPlan: { sha256: "0".repeat(64), document: { bindingIr: { semanticSha256: sha256(canonicalJson(document)) } } }
	});
	for(const [name, mutate] of [
		["callHost", trees => { trees.result.constructor = null; }]
		, ["callHost", trees => { trees.parameters[0].constructor = qualified("mkInterval"); }]
		, ["makeClosure", trees => { trees.parameters[0].constructor = null; }]
		, ["callHostNested", trees => { trees.result.fields[0].refinement.constructor = null; }]
		, ["callHostNested", trees => { trees.parameters[0].fields[0].refinement.constructor = qualified("checkedPositive"); }]
	]) {
		const changed = structuredClone(semantic.document);
		const declaration = changed.declarations.find(item => item.source.declaration === qualified(name));
		const site = name.startsWith("call") ? declaration.parameters[0] : declaration.result;
		mutate(changed.types.find(type => type.id === site.type.id).source.extensions[key]);
		assert.throws(() => generate(changed), /direction|Refinement does not match/u, name);
	}
	const adapter = generated.files["LeanBridgeGenerated.lean"];
	assert.match(adapter, /structure LbErased\.CallbackCheckedRecords\.Interval where/u);
	assert.match(adapter, /let a0 ← _root_\.CallbackCheckedRecords\.checkedPositive value\.«weight»\n\s+let a1 ← \(_root_\.Option\.some \(value\.«limit»\)\)\n\s+_root_\.CallbackCheckedRecords\.mkWeighted a0 a1/u);
	assert.match(adapter, /callbackDefault_[a-f0-9]+ : LbErased\.CallbackCheckedRecords\.Interval := \{ «lo» := 0, «hi» := 0 \}/u);
	assert.match(adapter, /_bridgeRecovery0 ← \(LbErased\.CallbackCheckedRecords\.Interval\.via_[a-f0-9]+ \(_bridgeRecoveryRaw0\)\)/u);
	assert.match(adapter, /LbErased\.CallbackCheckedRecords\.Interval\.erase \(_bridgeCallback0_0\)/u);
	assert.match(adapter, /_bridgeCallbackChecked_1 ← \(LbErased\.CallbackCheckedRecords\.Interval\.via_[a-f0-9]+ \(_bridgeCallbackResult_1\)\)/u);
	assert.doesNotMatch(adapter, /LbErased\.undefined|axiom|unsafeCast|sorry|panic!/u);
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
	assert.match(c, /_reject\(size_t token, lean_object \*recovery\)/u);
	if(wasm)
	{
		for(const name of ["LEAN_BRIDGE_LAKE_RUNTIME_ROOT", "LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_EMCC"])
			assert.ok(process.env[name], `${name} is required for the callback checked-record Wasm test`);
		await run(["-c", `${module}.c`, `${module}.lean`]);
		await run(["-c", "LeanBridgeGenerated.c", "LeanBridgeGenerated.lean"]);
		await writeFile(join(directory, "CallbackCheckedRecordBridge.c"), c);
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
			, `${module}.c`
			, "LeanBridgeGenerated.c"
			, "CallbackCheckedRecordBridge.c"
			, "-o"
			, "callback-checked-records.wasm"
		]);
		const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT);
		const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
		const engine = await createMain({ locateFile: path => join(runtimeRoot, path) });
		assert.equal(engine._bridge_lean_runtime_init(), 1);
		engine.FS.writeFile("/callback-checked-records.wasm", await readFile(join(directory, "callback-checked-records.wasm")));
		await engine.loadDynamicLibrary("/callback-checked-records.wasm", { global: true, loadAsync: true, nodelete: true });
		engine.FS.unlink("/callback-checked-records.wasm");
		const text = (value, operation) => {
			const bytes = new TextEncoder().encode(`${value}\0`), pointer = engine._malloc(bytes.length);
			assert.ok(pointer); engine.HEAP8.set(bytes, pointer);
			try
			{ return operation(pointer); }
			finally
			{ engine._free(pointer); }
		};
		assert.equal(text("initialize_LeanBridgeGenerated", pointer => engine._bridge_lean_component_initialize(pointer)), 1);
		const runtime = createComponentCallableRuntime(engine);
		const api = runtime.bind(generated.plan.privateAbi, new Map(generated.plan.privateAbi.exports.map(item => [item.bindingId
			, frame => text(item.symbol, pointer => engine._bridge_scalar_call(pointer, frame))])));
		const call = (name, ...args) => api.call(`lean:${module}.${name}`, args);
		const publicApi = { withRecovery: api.withRecovery };
		for(const name of Object.keys(contracts))
			publicApi[name.split(".").at(-1)] = (...args) => call(name.split(".").at(-1), ...args);
		assert.deepEqual(checkCallbackCheckedRecords(publicApi), callbackCheckedRecordExpected);
		runtime.assertOpen();
	}
});

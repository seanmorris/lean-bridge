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
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { callbackSubtypeDirection } from "../src/abi/refinements.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel } from "../src/analyze/semantic-model.mjs";

const enabled = process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_EXTRACTOR_TEST === "1";
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
	const run = args => promisify(execFile)(lean, args, { cwd: directory, env: environment, maxBuffer: 16 * 1024 * 1024, signal: t.signal });
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
});

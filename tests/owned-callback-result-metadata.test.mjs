/**
 * Check callback lifetime decisions against fresh ordinary and reviewed Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { callbackSemanticSignature } from "../src/analyze/callback-signature.mjs";
import { compilerExportSelection } from "../src/analyze/export-configuration.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { createOwnedElaboratedSemanticModel } from "../src/analyze/semantic-model.mjs";
import { validateReviewedOwnedSource, reviewedOwnedSourceSelection, reconcileReviewedOwnedSource } from "../src/analyze/reviewed-owned-source.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../src/build/javascript-wasm-owned-sources.mjs";
import { assertComponentOwnedWasmBindings } from "../src/abi/component-owned-wasm.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";

const capture = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source)
		, semanticSha256: sha256(canonicalizeJsonValue(document)) };
};

test("reviewed callback contracts use local anchors and keep leased signatures distinct", async () => {
	const ir = ownedCallbackResultReviewedIr(), review = capture(ir);
	validateReviewedOwnedSource(review);
	const selection = reviewedOwnedSourceSelection(review), configuration = await ownedCallbackResultConfiguration();
	assert.deepEqual(selection.contracts, configuration.contracts);
	const callbacks = ir.types.filter(type => type.kind === "callback");
	assert.equal(callbacks.length, 5);
	for(const type of callbacks)
	{
		const signature = callbackSemanticSignature(type.callable);
		assert.equal(type.id, "bridge:Callback" + sha256(canonicalJson(signature)).slice(0, 20));
		const renamed = structuredClone(type.callable);
		renamed.parameters.forEach((value, index) => { value.name = "renamed" + index; });
		if(renamed.result.ownership === "borrow") renamed.result.lifetime.anchor = renamed.parameters.at(-1).name;
		assert.deepEqual(callbackSemanticSignature(renamed), signature);
	}
	const result = name => ir.declarations.find(item => item.name === name).result.type.id;
	assert.notEqual(result("makeRecord"), result("makeLeasedRecord"));
});

for(const mode of ["ordinary", "reviewed"]) test(`fresh Lean preserves callable result anchors (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 300000
}, async t => {
	const root = process.cwd(), directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-result-metadata-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const lean = join(prefix, "bin/lean"), extractor = join(root, "src/analyze/NativeExports.lean");
	const run = args => processBuildRunner.capture({
		command: lean, args, cwd: directory
		, env: { ...process.env, LEAN_PATH: directory, PATH: `${join(prefix, "bin")}:${process.env.PATH}` }
	});
	const source = (await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")) + ownedCallbackResultSource;
	await saveLakeFile(directory, "Owned.lean", source); await run(["-o", "Owned.olean", "Owned.lean"]);
	const compiledInterface = await identifyLeanInterface(join(directory, "Owned.olean"));
	const configuration = await ownedCallbackResultConfiguration(), review = capture(ownedCallbackResultReviewedIr());
	const context = { toolchain: "leanprover/lean4:v4.32.2"
		, extractorSha256: sha256(await readFile(extractor))
		, leanCompilerSha256: sha256(await readFile(lean))
		, ...mode === "reviewed" ? { reviewedBindingIrSha256: sha256(canonicalJson(review)) } : {}
		, modules: [{ name: "Owned", sourcePath: "Owned.lean", sourceSha256: sha256(source), interfaceSha256: compiledInterface.interfaceSha256 }] };
	const selection = mode === "reviewed" ? reviewedOwnedSourceSelection(review) : {
		exports: configuration.exports, resources: configuration.resources
		, arities: Object.entries(configuration.arities), ...compilerExportSelection(configuration)
	};
	const request = createMetadataRequest({ profile: "native-library-v1", modules: ["Owned"], exportModules: ["Owned"], ...selection }, context);
	await saveLakeFile(directory, "request.json", canonicalJson(request));
	const metadata = JSON.parse((await run(["--run", extractor, "--metadata", "request.json"])).stdout);
	assert.deepEqual(metadata.diagnostics, []); validateElaboratedMetadata(metadata, request);
	const { document } = createOwnedElaboratedSemanticModel({
		metadata, request, component: ownedCallbackResultReviewedIr().component
		, elaborationSha256: sha256(canonicalJson(metadata))
	});
	const callbacks = document.types.filter(type => type.kind === "callback");
	assert.equal(callbacks.length, 5); assert.equal(callbacks.filter(type => type.callable.result.ownership === "borrow").length, 4);
	for(const type of callbacks.filter(type => type.callable.result.ownership === "borrow"))
		assert.equal(type.callable.result.lifetime.anchor, `arg${type.callable.parameters.length - 1}`);
	const config = mode === "reviewed" ? { schemaVersion: 1, modules: ["Owned"] } : configuration;
	const sourceIdentity = { request, leanVersion: "4.32.2"
		, leanCommit: (await run(["--githash"])).stdout.trim()
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, sourceTreeSha256: sha256(source)
		, exportConfigurationSource: canonicalJson(config)
		, exportConfigurationSha256: sha256(canonicalJson(config))
		, ...mode === "reviewed" ? { reviewedBindingIr: review } : {}
		, modules: [{ module: "Owned"
			, source: { path: "Owned.lean", sha256: sha256(source) }
			, interface: { sha256: compiledInterface.oleanSha256, interfaceSha256: compiledInterface.interfaceSha256 } }] };
	const input = { metadata, sourceIdentity, component: document.component };
	assert.throws(() => createCompiledNativeModel(input, { ownedGraphs: true
		, ownedHostCallbacks: true, ownedInputTransfers: true
		, ownedAnchoredResults: true, ownedReceiverExports: true })
	, { code: "native-owned-callback-anchors-unavailable" });
	for(const value of [null, 1, "true"])
		assert.throws(() => createCompiledNativeModel(input, { ownedGraphs: true, ownedCallbackResultAnchors: value }), /capability must be explicit/u);
	assert.throws(() => createCompiledNativeModel(input, { ownedCallbackResultAnchors: true }), /ownership-aware transport/u);
	const models = [];
	for(const ownedHostCallbacks of [false, true])
	{
		const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedCallbackResultAnchors: true, ownedHostCallbacks });
		assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
		assert.equal(model.ownedGraph.receiverExports, undefined);
		assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(model.ownedGraph.inputTransfers, undefined);
		assert.equal(Boolean(model.ownedGraph.hostCallbacks), ownedHostCallbacks);
		assert.deepEqual(model.ownedGraph.callbackResultAnchors.signatures, model.bindingIr.types
			.filter(type => type.kind === "callback" && type.callable.result.ownership === "borrow")
			.map(type => ({ id: type.id, parameter: type.callable.parameters.length - 1 })));
		assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
		const adapters = generateCompiledNativeLeanAdapters(model);
		assert.equal(typeof adapters.callbackSource, ownedHostCallbacks ? "string" : "undefined");
		await saveLakeFile(directory, adapters.module + ".lean", adapters.leanSource);
		await run(["-o", adapters.module + ".olean", "-c", adapters.module + ".c", adapters.module + ".lean"]);
		for(const mutate of [
			value => { delete value.ownedGraph.callbackResultAnchors; }
			, value => { value.ownedGraph.callbackResultAnchors.signatures.pop(); }
			, value => { value.ownedGraph.callbackResultAnchors.signatures[0].parameter++; }
			, value => { value.ownedGraph.callbackResultAnchors.signatures[0].id += "changed"; }
			, value => { value.ownedGraph.callbackResultAnchors.lifetime = "call"; }
			, value => { value.ownedGraph.callbackResultAnchors.hostResultHandoff = "after-callback-frame-expires"; }
			, value => { value.ownedGraph.callbackResultAnchors.maximumDepth++; }
			, value => { value.ownedGraph.receiverExports = { schemaVersion: 1, exports: [] }; }
			, value => { value.ownedGraph.resultAnchors = { schemaVersion: 1, exports: [] }; }
			, value => { value.schemaVersion = 6; value.ownedGraph.schemaVersion = 1; }
			, value => { value.ownedGraph.schemaVersion = 5; }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateCompiledNativeLeanAdapters(changed), undefined, mutate.toString());
		}
		models.push(model);
		const wasm = createOwnedJavaScriptWasmModel({ ...input, hostCallbacks: ownedHostCallbacks, callbackResultAnchors: true });
		assert.equal(wasm.schemaVersion, 11); assert.equal(wasm.ownedGraph.schemaVersion, 6);
		assert.equal(wasm.pointerBits, 32);
		assert.deepEqual(wasm.ownedGraph.callbackResultAnchors, model.ownedGraph.callbackResultAnchors);
		const wasmAdapters = generateOwnedJavaScriptWasmLeanAdapters(wasm);
		assert.equal(wasmAdapters.leanSource, adapters.leanSource);
		const generated = generateCompiledJavaScriptWasmOwned(wasm, metadata, wasmAdapters);
		assert.equal(generated.privateAbi.version, 14); assert.equal(generated.receipt.schemaVersion, 5);
		assert.equal(generated.privateAbi.resultAnchors, undefined);
		assert.equal(generated.privateAbi.receiverExports, undefined);
		assert.equal(generated.privateAbi.inputTransfers, undefined);
		assert.equal(typeof generated.privateAbi.callbackKey, ownedHostCallbacks ? "string" : "object");
		assert.deepEqual(generated.privateAbi.callbackResultAnchors.signatures, model.ownedGraph.callbackResultAnchors.signatures);
		for(const mutate of [
			value => { value.version = 13; }
			, value => { delete value.callbackResultAnchors; }
			, value => { value.callbackResultAnchors.signatures.pop(); }
			, value => { value.callbackResultAnchors.signatures[0].parameter++; }
			, value => { value.callbackResultAnchors.anchor = "closure-owner"; }
			, value => { value.callbackResultAnchors.maximumDepth++; }
			, value => { value.resultAnchors = {}; }
			, value => { value.receiverExports = {}; }
			, value => { value.inputTransfers = {}; }
		]) {
			const changed = structuredClone(generated.privateAbi); mutate(changed);
			assert.throws(() => assertComponentOwnedWasmBindings(changed, wasm.bindingIr), undefined, mutate.toString());
		}
		for(const mutate of [
			value => { value.schemaVersion = 10; }
			, value => { value.ownedGraph.schemaVersion = 5; }
			, value => { delete value.ownedGraph.callbackResultAnchors; }
			, value => { value.ownedGraph.callbackResultAnchors.signatures[0].parameter++; }
			, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
			, value => { value.ownedGraph.hostCallbacks = {}; }
		]) {
			const changed = structuredClone(wasm); mutate(changed);
			assert.throws(() => generateOwnedJavaScriptWasmLeanAdapters(changed), undefined, mutate.toString());
		}
	}
	await saveLakeFile(resolve("build/owned-callback-results"), `metadata-${mode}.json`, canonicalJson({ input, models }));
	if(mode === "ordinary") for(const [name, mutate] of [
		["Owned.makeRecord", value => { value.result.callable.result.lifetime.anchor = "arg0"; }]
		, ["Owned.makeRecord", value => { value.result.callable.result.lifetime.anchor = "arg2"; }]
		, ["Owned.makeRecord", value => { value.result.callable.result.lifetime = { scope: "receiver", anchor: "receiver" }; }]
		, ["Owned.makeRecord", value => { value.result.callable = { parameters: [], result: { ownership: "lease", lifetime: { scope: "explicit", anchor: null } } }; }]
		, ["Owned.callbackRecord", value => { value.parameters[1].callable.parameters = [{ ownership: "transfer", lifetime: { scope: "call", anchor: null } }]; }]
	]) {
		const selected = structuredClone(selection); mutate(selected.contracts[name]);
		const rejectedRequest = createMetadataRequest({ profile: "native-library-v1", modules: ["Owned"], exportModules: ["Owned"], ...selected }, context);
		await saveLakeFile(directory, "request.json", canonicalJson(rejectedRequest));
		const rejected = JSON.parse((await run(["--run", extractor, "--metadata", "request.json"])).stdout);
		validateElaboratedMetadata(rejected, rejectedRequest);
		const declaration = rejected.modules.flatMap(value => value.declarations).find(value => value.identity === name);
		assert.equal(declaration.projection.status, "unsupported");
		assert.equal(declaration.projection.reason, "export-contract-mismatch");
		assert.ok(rejected.diagnostics.some(value => value.declaration === name && value.code === "export-contract-mismatch"));
	}
	if(mode === "reviewed")
	{
		const reconciled = reconcileReviewedOwnedSource(review, document, {
			request, reviewedBindingIr: review
			, exportConfigurationSource: canonicalJson(config)
			, exportConfigurationSha256: sha256(canonicalJson(config))
		});
		for(const type of reconciled.types.filter(type => type.kind === "callback" && type.callable.result.ownership === "borrow"))
			assert.equal(type.callable.result.lifetime.anchor, type.callable.parameters.at(-1).name);
	}
});

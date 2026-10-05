/**
 * Receiver decisions retain compiler authority and exact original-owner anchors.
 * Installed packages and other host projections are separate acceptance gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createMetadataRequest, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { validateExportConfiguration, exportContractProblem } from "../src/analyze/export-configuration.mjs";
import { reconcileReviewedOwnedSource } from "../src/analyze/reviewed-owned-source.mjs";
import { compileOwnedNativeValueLayout } from "../src/backends/native/owned-value-layout.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { validateOwnedAggregateBindingIr } from "../src/binding-ir/contract.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr, ownedReceiverSource, ownedReceiverKinds, ownedReceiverProbe, ownedReceiverCopyMacros } from "./helpers/owned-receiver-fixture.mjs";
import { ownedReceiverMutants } from "./helpers/owned-receiver-mutants.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("receiver configuration and schema agree on closed lifetime decisions", async () => {
	const configuration = await ownedReceiverConfiguration();
	assert.equal(validateExportConfiguration(configuration), configuration);
	await assertJsonSchema("lean-export-configuration", configuration);
	for(const mutate of [
		value => { value.contracts["Owned.primary"].receiver = "static"; }
		, value => { value.contracts["Owned.primary"].receiver = { kind: "property" }; }
		, value => { value.contracts["Owned.primary"].result.lifetime.anchor = null; }
		, value => { value.contracts["Owned.primary"].result.lifetime.anchor = "arg0"; }
		, value => { value.contracts["Owned.chooseTicket"].result.lifetime.anchor = "receiver"; }
	]) {
		const changed = structuredClone(configuration); mutate(changed);
		assert.throws(() => validateExportConfiguration(changed), { code: "invalid-export-configuration" });
		await assert.rejects(() => assertJsonSchema("lean-export-configuration", changed));
	}
	const resource = { kind: "resource" }, scalar = { kind: "primitive", name: "nat" };
	const projection = { status: "supported", parameters: [{ type: resource }], result: resource };
	const decision = configuration.contracts["Owned.primary"];
	assert.equal(exportContractProblem(decision, projection, true), null);
	assert.match(exportContractProblem(decision, projection), /ownership-aware/u);
	assert.match(exportContractProblem(decision, { ...projection, parameters: [] }, true), /receiver/u);
	assert.match(exportContractProblem(decision, { ...projection, parameters: [{ type: scalar }] }, true), /receiver/u);
	assert.match(exportContractProblem(decision, { ...projection, parameters: [{ type: resource }, { type: resource }] }, true), /property/u);
	assert.match(exportContractProblem({ result: decision.result }, projection, true), /anchor/u);
	assert.match(exportContractProblem({ receiver: "method", result: { ownership: "borrow", lifetime: { scope: "parameter", anchor: "arg0" } } }, projection, true), /receiver scope/u);
});

test("native receiver layouts preserve receiver and remaining-argument positions", () => {
	const ir = ownedReceiverReviewedIr(); assert.equal(validateOwnedAggregateBindingIr(ir), ir);
	const options = { transferredInputs: true, anchoredResults: true };
	assert.throws(() => compileOwnedNativeValueLayout(ir, options), /only synchronous function/u);
	const layout = compileOwnedNativeValueLayout(ir, { ...options, receiverExports: true });
	assert.equal(layout.functions.filter(item => item.receiver === 0).length, 15);
	assert.equal(layout.functions.find(item => item.name === "primary").anchor, 0);
	assert.equal(layout.functions.find(item => item.name === "chooseTicket").anchor, 1);
	assert.deepEqual(layout.functions.find(item => item.name === "mixedTicket").transfers, [1]);
	assert.deepEqual(layout.functions.find(item => item.name === "transferTicket").transfers, [0]);
	const previous = ownedBorrowReviewedIr({ mixed: true });
	assert.deepEqual(compileOwnedNativeValueLayout(previous, { ...options, receiverExports: true }), compileOwnedNativeValueLayout(previous, options));
});

for(const mode of ["ordinary", "reviewed"]) test(`receiver results execute through fresh Lean and the public C API (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RECEIVER_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedReceiverConfiguration() } : { reviewedIr: ownedReceiverReviewedIr() }
		, sourceSuffix: ownedReceiverSource, hostCallbacks: true
		, evidenceName: `receiver-${mode}-inputs.json`
	});
	const declarations = compiled.model.bindingIr.declarations;
	for(const [name, kind] of Object.entries(ownedReceiverKinds))
	{
		const declaration = declarations.find(item => item.name === name);
		assert.equal(declaration.kind, kind); assert.ok(declaration.receiver);
		assert.equal(declaration.owner, declaration.receiver.type.id);
	}
	const options = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true
		, anchoredResults: true, transferredInputs: true, receiverExports: true };
	assert.throws(() => generateOwnedCPackage({ ...options, receiverExports: false }), /only synchronous function/u);
	const generated = generateOwnedCPackage(options);
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
		, ownedInputTransfers: true, ownedAnchoredResults: true
		, ownedReceiverExports: true };
	assert.throws(() => createCompiledNativeModel(options, { ...capabilities, ownedReceiverExports: false }), { code: "native-owned-receivers-unavailable" });
	assert.throws(() => createCompiledNativeModel(options, { ...capabilities, ownedReceiverExports: "true" }), /must be explicit/u);
	const model = createCompiledNativeModel(options, capabilities);
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
	assert.equal(model.ownedGraph.receiverExports.exports.length, 15);
	assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.primary"), { bindingId: "lean:Owned.primary", receiver: true });
	assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
	assert.equal(generateCompiledNativeLeanAdapters(model).leanSource, compiled.leanSource);
	for(const mutate of [
		value => { delete value.ownedGraph.receiverExports; }
		, value => { value.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.ownedGraph.receiverExports.exports[0].argument = 1; }
		, value => { value.ownedGraph.resultAnchors.lifetime = "parameter"; }
		, value => { value.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket").parameter = 1; }
		, value => { value.schemaVersion = 9; value.ownedGraph.schemaVersion = 4; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateCompiledNativeLeanAdapters(changed));
	}
	const implementation = source => `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${source}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation(source) : source);
	await saveLakeFile(compiled.directory, "borrow-copies.h", ownedReceiverCopyMacros(generated.values));
	const source = await ownedReceiverProbe();
	for(const fn of generated.values.functions.filter(item => item.receiver === 0))
		assert.match(source, new RegExp(`\\b${fn.cName}\\b`, "u"), fn.name);
	const normal = await (await compiled.compile(mode + "-receivers", source, false, ["public-api.c", "-lgmp"]))();
	assert.equal(normal.stderr, ""); const result = JSON.parse(normal.stdout);
	assert.ok(result.checks > 1000); assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile(mode + "-receivers-sanitized", source, true, ["public-api.c", "-lgmp"]);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.equal(exercised.stdout, normal.stdout);
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const mutations = ownedReceiverMutants(generated);
	for(const mutation of mutations)
	{
		await saveLakeFile(compiled.directory, "public-api.c", implementation(mutation.source));
		const broken = await compiled.compile(mode + "-" + mutation.name, source, false, ["public-api.c", "-lgmp"]);
		await assert.rejects(() => broken(), /borrow C check failed/u, mutation.name);
	}
	await saveLakeFile(compiled.directory, "public-api.c", implementation(generated.source));
	const restored = await (await compiled.compile(mode + "-restored", source, false, ["public-api.c", "-lgmp"]))();
	assert.equal(restored.stdout, normal.stdout); assert.equal(restored.stderr, "");
	const rejected = [];
	if(mode === "reviewed")
	{
		for(const mutate of [
			value => { value.declarations.find(item => item.name === "primary").kind = "method"; }
			, value => { value.declarations.find(item => item.name === "chooseTicket").result.lifetime = { scope: "receiver", anchor: "receiver" }; }
		]) {
			const changed = structuredClone(model.bindingIr); mutate(changed);
			assert.throws(() => reconcileReviewedOwnedSource(compiled.sourceIdentity.reviewedBindingIr, changed, compiled.sourceIdentity), { code: "reviewed-ir-source-mismatch" });
		}
	}
	else
	{
		const prefix = resolve(".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
		const { metadata: captured, ...selection } = compiled.sourceIdentity.request;
		const borrowed = { ownership: "borrow", lifetime: { scope: "receiver", anchor: "receiver" } };
		for(const [name, contract] of [
			["Owned.newTicket", { receiver: "method" }]
			, ["Owned.echoArray", { receiver: "method" }]
			, ["Owned.callbackRecord", { receiver: "property" }]
			, ["Owned.primary", { result: borrowed }]
			, ["Owned.primary", { receiver: "property", result: { ownership: "borrow", lifetime: { scope: "parameter", anchor: "arg0" } } }]
			, ["Owned.retainTicket", { receiver: "method", result: borrowed, parameters: [{ ownership: "transfer", lifetime: { scope: "call", anchor: null } }] }]
			, ["Owned.chooseTicket", { receiver: "method", result: { ownership: "borrow", lifetime: { scope: "parameter", anchor: "arg2" } } }]
		]) {
			const request = createMetadataRequest({ ...selection, contracts: { [name]: contract } }, {
				toolchain: captured.toolchain, modules: captured.modules
				, leanCompilerSha256: compiled.sourceIdentity.leanCompilerSha256
				, extractorSha256: compiled.sourceIdentity.extractorSha256 });
			await saveLakeFile(compiled.directory, "invalid-receiver.json", canonicalJson(request));
			const observed = await processBuildRunner.capture({ command: join(prefix, "bin/lean")
				, args: ["--run", resolve("src/analyze/NativeExports.lean"), "--metadata", "invalid-receiver.json"]
				, cwd: compiled.directory
				, env: { ...process.env, LEAN_PATH: compiled.directory }
				, timeoutMs: 180000 });
			const metadata = JSON.parse(observed.stdout); validateElaboratedMetadata(metadata, request);
			const declaration = metadata.modules[0].declarations.find(item => item.identity === name);
			assert.equal(declaration.projection.status, "unsupported");
			assert.equal(declaration.projection.reason, "export-contract-mismatch");
			const original = compiled.metadata.modules[0].declarations.find(item => item.identity === name).projection;
			assert.ok(exportContractProblem(contract, original, true));
			rejected.push({ name, contract, projection: declaration.projection });
		}
	}
	await saveLakeFile("build/owned-receivers", mode + ".json", canonicalJson({
		mode, result, input: options, model
		, receivers: declarations.filter(item => item.receiver).map(item => item.id)
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, sanitizer: "address,undefined"
		, rejected, reviewedMismatchRejected: mode === "reviewed"
		, rejectedMutations: mutations.map(item => item.name), restored: true
		, mutations: mutations.map(item => ({ name: item.name
			, sourceSha256: sha256(item.source)
			, compiled: true, semanticRejection: true }))
		, startupLeakBaseline: normalize(cold.stderr) }));
	t.diagnostic(JSON.stringify({ mode, ...result }));
});

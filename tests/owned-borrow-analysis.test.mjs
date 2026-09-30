/**
 * Preserve authored borrowed-result anchors through fresh Lean and review.
 * Backend admission remains closed until the corresponding public APIs exist.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createMetadataRequest, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { exportContractProblem } from "../src/analyze/export-configuration.mjs";
import { reconcileReviewedOwnedSource } from "../src/analyze/reviewed-owned-source.mjs";
import { compileOwnedNativeValueLayout } from "../src/backends/native/owned-value-layout.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedBorrowNames as names, borrowedResult as borrowed, ownedBorrowContracts as contracts
	, ownedBorrowConfiguration as configuration, ownedBorrowReviewedIr as reviewed } from "./helpers/owned-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("borrowed result decisions require a live, non-copied, non-transferred input anchor", () => {
	const type = { kind: "owned-graph" }, copy = { kind: "primitive", name: "nat" };
	const projection = { status: "supported", parameters: [{ type }, { type: copy }], result: type };
	assert.equal(exportContractProblem({ result: borrowed("arg0") }, projection, true), null);
	assert.match(exportContractProblem({ result: borrowed("arg0") }, projection), /lifetime/u);
	for(const anchor of ["arg1", "arg2", "arg00", "receiver", null])
		assert.match(exportContractProblem({ result: borrowed(anchor) }, projection, true), /anchor/u);
	const consuming = [
		{ ownership: "transfer", lifetime: { scope: "call", anchor: null } }
		, { ownership: "copy", lifetime: null }
	];
	assert.match(exportContractProblem({ result: borrowed("arg0"), parameters: consuming }, projection, true), /transferred input/u);
	assert.match(exportContractProblem({ result: borrowed("arg0") }, { ...projection, result: copy }, true), /ownership/u);
	assert.throws(() => compileOwnedNativeValueLayout(reviewed(), { transferredInputs: true }), /explicit output leases/u);
});

for(const mode of ["ordinary", "reviewed"]) test(`${mode} fresh Lean preserves all eighteen aggregate result anchors`, {
	skip: process.env.LEAN_BRIDGE_OWNED_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewed() }
		, evidenceName: `borrow-analysis-${mode}-inputs.json`
	});
	assert.deepEqual(compiled.sourceIdentity.request.contracts, contracts);
	assert.equal(compiled.model.declarations.length, 22);
	const declarations = compiled.model.bindingIr.declarations;
	assert.equal(declarations.filter(item => item.result.ownership === "borrow").length, 18);
	for(const item of declarations.filter(item => names.includes(item.name)))
		assert.deepEqual({ ownership: item.result.ownership, lifetime: item.result.lifetime }
			, borrowed(`${mode === "reviewed" ? "owner" : "arg"}${item.name === "bundle" ? "2" : "0"}`));
	assert.throws(() => compileOwnedNativeValueLayout(compiled.model.bindingIr, { transferredInputs: true }), /explicit output leases/u);
	const input = { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component };
	const nativeModel = createCompiledNativeModel(input, { ownedGraphs: true, ownedAnchoredResults: true });
	assert.equal(nativeModel.schemaVersion, 9);
	assert.equal(nativeModel.ownedGraph.resultAnchors.exports.length, 18);
	assert.equal(nativeModel.ownedGraph.inputTransfers, undefined);
	assert.equal(nativeModel.ownedGraph.hostCallbacks, undefined);
	assert.equal(generateCompiledNativeLeanAdapters(nativeModel).callbackSource, undefined);
	const c = generateOwnedCPackage({ ...input, anchoredResults: true });
	for(const [name, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, name.startsWith("src/") ? "borrow-api.c" : name.split("/").at(-1), source);
	const page = await readFile("docs/consume/c.md", "utf8");
	const example = page.split("### Borrowed results\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	const execute = await compiled.compile(`${mode}-borrow-only`, example, false, ["borrow-api.c", "-lgmp"]);
	const observed = await execute(); assert.equal(observed.stderr, ""); assert.equal(observed.stdout, "42\n");
	if(mode === "reviewed")
	{
		const changed = structuredClone(compiled.model.bindingIr);
		changed.declarations.find(item => item.name === "bundle").result.lifetime.anchor = "owner0";
		assert.throws(() => reconcileReviewedOwnedSource(compiled.sourceIdentity.reviewedBindingIr, changed, compiled.sourceIdentity)
			, { code: "reviewed-ir-source-mismatch" });
	}
	const rejected = [];
	if(mode === "ordinary")
	{
		const prefix = resolve(".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
		const { metadata: captured, ...selection } = compiled.sourceIdentity.request;
		for(const [name, contract] of [
			["Owned.echoRecord", { result: borrowed("arg99") }]
			, ["Owned.newTicket", { result: borrowed("arg0") }]
			, ["Owned.echoRecord", { result: borrowed("arg0"), parameters: [{ ownership: "transfer", lifetime: { scope: "call", anchor: null } }] }]
			, ["Owned.echoRecord", { result: { ownership: "borrow", lifetime: { scope: "call", anchor: null } } }]
			, ["Owned.serial", { result: borrowed("arg0") }]
		]) {
			const request = createMetadataRequest({ ...selection, contracts: { [name]: contract } }, {
				toolchain: captured.toolchain, modules: captured.modules
				, leanCompilerSha256: compiled.sourceIdentity.leanCompilerSha256
				, extractorSha256: compiled.sourceIdentity.extractorSha256
			});
			await saveLakeFile(compiled.directory, "invalid-borrow-request.json", canonicalJson(request));
			const result = await processBuildRunner.capture({ command: join(prefix, "bin/lean")
				, args: ["--run", resolve("src/analyze/NativeExports.lean"), "--metadata", "invalid-borrow-request.json"]
				, cwd: compiled.directory
				, env: { ...process.env, LEAN_PATH: compiled.directory }
				, timeoutMs: 180000 });
			const metadata = JSON.parse(result.stdout); validateElaboratedMetadata(metadata, request);
			const declaration = metadata.modules[0].declarations.find(item => item.identity === name);
			assert.equal(declaration.projection.status, "unsupported");
			assert.equal(declaration.projection.reason, "export-contract-mismatch");
			const original = compiled.metadata.modules[0].declarations.find(item => item.identity === name).projection;
			assert.ok(exportContractProblem(contract, original, true));
			rejected.push({ name, contract, projection: declaration.projection });
		}
	}
	const report = { mode, realLean: true, exports: 22, anchoredResults: 18
		, defaultCapabilityRejected: true, reviewedNamesPreserved: mode === "reviewed"
		, rejected, model: compiled.model
		, nativeModel
		, borrowedOnlyC: { sourceSha256: sha256(c.source)
			, exampleSha256: sha256(example), stdout: observed.stdout }
		, sourceIdentity: compiled.sourceIdentity, metadata: compiled.metadata };
	await saveLakeFile(resolve("build/owned-borrows"), `analysis-${mode}.json`, canonicalJson(report));
	t.diagnostic(`${mode}: 18 anchored result contracts, ${rejected.length} rejected compiler contracts`);
});

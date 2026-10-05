/**
 * Check transfer decisions through the public compiler-only analysis boundary.
 * The process harness runs real Lean, not an actual Nix or Docker container.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { analyzeCompilerProject } from "../src/analyze/compiler-analysis.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { validateCompilerProjectAnalysis } from "../src/analyze/project-analysis.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { ownedAnalysisTransport } from "./helpers/owned-analysis.mjs";
import { ownedTransferConfiguration, ownedTransferReviewedIr, ownedTransferSource } from "./helpers/owned-transfer-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`${mode} compiler-only analysis preserves authorized input transfers`, {
	skip: process.env.LEAN_BRIDGE_OWNED_TRANSFER_PACKAGE_TEST !== "1"
	, timeout: 300000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-transfer-analysis-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "source");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), root, { recursive: true });
	await saveLakeFile(root, "Owned.lean", (await readFile(join(root, "Owned.lean"), "utf8")) + ownedTransferSource);
	const configuration = await ownedTransferConfiguration();
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson(mode === "ordinary" ? configuration : { schemaVersion: 1, modules: ["Owned"] }));
	if(mode === "reviewed") await saveLakeFile(root, "api.binding-ir.json", canonicalJson(ownedTransferReviewedIr()));
	const before = await lakeInputState(root), observed = [];
	const analysis = await analyzeCompilerProject(root, {
		runner: ownedAnalysisTransport({ observed })
		, environment: { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix" }
	});
	assert.deepEqual(await lakeInputState(root), before);
	assert.equal(analysis.compiledEnvironment.status, "available");
	assert.deepEqual(analysis.adapterHints, []);
	assert.equal(analysis.bindingIr.document.schemaVersion, 4);
	assert.deepEqual(analysis.elaboration.request.contracts, configuration.contracts);
	const declarations = analysis.bindingIr.document.declarations;
	assert.equal(declarations.filter(item => item.parameters.some(parameter => parameter.ownership === "transfer")).length, 18);
	const actual = declarations.find(item => item.name === "bundle").parameters;
	assert.deepEqual(actual.map(item => item.ownership), ["transfer", "borrow", "transfer", "borrow", "copy"]);
	assert.equal(actual[2].lifetime.scope, "explicit");
	assert.ok(observed.some(args => args.includes("--metadata")));
	const inventory = await inspectLeanProject(root);
	const intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis", ownedGraphs: true });
	assert.equal(validateCompilerProjectAnalysis(analysis, inventory, intent), true);
	for(const mutate of [
		value => { delete value.elaboration.request.contracts; }
		, value => { value.elaboration.request.contracts["Owned.echoRecord"].parameters[0].ownership = "borrow"; }
		, value => { value.bindingIr.document.declarations.find(item => item.name === "echoRecord").parameters[0].ownership = "borrow"; }
	]) {
		const changed = structuredClone(analysis); mutate(changed);
		assert.throws(() => validateCompilerProjectAnalysis(changed, inventory, intent));
	}
	await saveLakeFile(resolve("build/owned-transfer-packaging"), `analysis-${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, adaptersCompiled: false, processTransportInjected: true
		, sourceUnchanged: true, transfers: 18, rejectedMutations: 3
		, observed, analysisSha256: sha256(canonicalJson(analysis)), analysis
	}));
});

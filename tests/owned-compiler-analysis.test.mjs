/**
 * Compiler-only ownership analysis must agree with source decisions and reviews.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { analyzeCompilerProject } from "../src/analyze/compiler-analysis.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { validateCompilerProjectAnalysis } from "../src/analyze/project-analysis.mjs";
import { projectElaboratedMetadata } from "../src/analyze/project-elaborated.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { builtinAnalysisPolicyRecord, evaluateAnalysisPolicy } from "../src/analyze/policy.mjs";
import { validateOwnedAggregateBindingIr } from "../src/binding-ir/contract.mjs";
import { compileOwnedAggregateModel } from "../src/abi/owned-aggregate-model.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createCliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { ownedAnalysisFixture as fixture, ownedAnalysisTransport as transport } from "./helpers/owned-analysis.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_COMPILER_ANALYSIS_TEST === "1";
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix" };
const handlers = runner => createCliHandlers({ analyze: (root, options) => analyzeCompilerProject(root, { ...options, runner, environment }) });
const rebind = value => {
	const elaboration = value.elaboration, { metadata, ...selection } = elaboration.request;
	elaboration.request = createMetadataRequest(selection, { toolchain: value.project.toolchain
		, snapshotSha256: elaboration.snapshotSha256
		, generatedSourcesSha256: elaboration.generatedSourcesSha256
		, leanCompilerSha256: elaboration.leanCompilerSha256
		, extractorSha256: elaboration.extractorSha256
		, ...(elaboration.reviewedBindingIr ? { reviewedBindingIrSha256: sha256(canonicalJson(elaboration.reviewedBindingIr)) } : {})
		, modules: metadata.modules });
	elaboration.metadata.producer.invocationIdentitySha256 = elaboration.request.metadata.invocationIdentitySha256;
};

test("owned reviews require fresh compiler evidence, not a parser-only success", async t => {
	const { root, directory } = await fixture(t, true), before = await lakeInputState(root);
	const runner = { capture: async () => { throw Object.assign(new Error("No Nix installed"), { code: "ENOENT" }); } };
	const result = await runCli({ argv: ["analyze", "--project", root, "--json"], handlers: handlers(runner) });
	assert.equal(result.response.status, "blocked", JSON.stringify(result.response));
	assert.equal(result.response.result, null);
	assert.equal(result.response.diagnostics[0].code, "nix-unavailable");
	assert.deepEqual(await lakeInputState(root), before);
	assert.deepEqual(await readdir(directory), ["source"]);
});

for(const reviewed of [false, true]) test(`compiler-only ${reviewed ? "reviewed" : "ordinary"} ownership analysis checks all public shapes`, { skip: !enabled, timeout: 300000 }, async t => {
	const { root, directory } = await fixture(t, reviewed), before = await lakeInputState(root);
	let released;
	const observed = [], output = join(directory, "analysis");
	const runner = transport({ observed
		, after: async options => {
			released = { analysis: await readFile(join(options.outputRoot, "analysis/project-analysis.json"))
				, report: await readFile(join(options.outputRoot, "engine-execution-report.json")) };
		}
	});
	const result = await runCli({ argv: ["analyze", "--project", root, "--check", "--output", output, "--json"], handlers: handlers(runner) });
	assert.equal(result.exitCode, 0, JSON.stringify(result.response.diagnostics));
	const analysis = result.response.result;
	await assertJsonSchema("project-analysis", analysis);
	assert.equal(analysis.bindingIr.origin, "lean-elaborated");
	assert.equal(analysis.bindingIr.document.schemaVersion, 4);
	validateOwnedAggregateBindingIr(analysis.bindingIr.document);
	const model = compileOwnedAggregateModel(analysis.bindingIr.document);
	assert.equal(model.declarations.length, ownedDotnetCallbacksReviewedIr().declarations.length);
	assert.deepEqual(analysis.adapterHints, []);
	assert.equal(analysis.compiledEnvironment.status, "available");
	assert.ok(analysis.exportCandidates.every(item => item.evidence.includes("compiled-interface:fresh")));
	const policy = builtinAnalysisPolicyRecord();
	assert.equal(evaluateAnalysisPolicy({ analysis, policyRecord: { ...policy, document: { ...policy.document, requireCompiledExports: true, allowStaticallyInferredIr: false } } }).passed, true);
	assert.ok(observed.some(args => args.includes("--metadata")));
	assert.equal(analysis.elaboration.request.profile, "native-library-v1");
	assert.deepEqual(analysis.elaboration.request.resources, ["Owned.Ticket"]);
	assert.deepEqual(analysis.elaboration.request.ownedAggregates, ownedDotnetCallbacksReviewedIr().aggregatePolicy);
	assert.deepEqual(JSON.parse(await readFile(join(output, "binding-ir.json"), "utf8")), analysis.bindingIr.document);
	assert.deepEqual(await lakeInputState(root), before);
	const inventory = await inspectLeanProject(root);
	const intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis", ownedGraphs: true });
	await assertJsonSchema("lake-entry-intent", intent.document);
	assert.equal(validateCompilerProjectAnalysis(analysis, inventory, intent), true);
	assert.throws(() => projectElaboratedMetadata(inventory, intent.document.modules, analysis.elaboration), /scalar metadata profile/);
	for(const change of [
		value => { value.elaboration.request.resources = []; }
		, value => { value.elaboration.request.ownedAggregates.fallback = "none"; }
		, value => { value.elaboration.request.arities = []; }
		, value => { value.elaboration.request.profile = "component-scalars-v1"; }
		, value => { value.elaboration.request.exports = ["Owned.serial"]; }
		, value => { value.elaboration.request.exportModules = ["Forged"]; }
		, value => { value.elaboration.request.metadata.modules[0].sourceSha256 = "0".repeat(64); }
		, value => { value.bindingIr.semanticSha256 = "0".repeat(64); }
		, value => { value.bindingIr.document.declarations[0].result.ownership = "copy"; }
	]) {
		const invalid = structuredClone(analysis); change(invalid); rebind(invalid);
		assert.throws(() => validateCompilerProjectAnalysis(invalid, inventory, intent));
	}
	for(const change of [
		value => { value.bindingIr.document.aggregatePolicy.fallback = "none"; }
		, (_value, report) => { report.adaptersCompiled = true; }
	]) {
		let staging;
		const replay = transport({ execute: async options => {
			staging = dirname(options.inputRoot);
			const value = JSON.parse(released.analysis), report = JSON.parse(released.report);
			change(value, report); const bytes = canonicalJson(value); report.analysisSha256 = sha256(bytes);
			await mkdir(join(options.outputRoot, "analysis"), { recursive: true });
			await saveLakeFile(options.outputRoot, "analysis/project-analysis.json", bytes);
			await saveLakeFile(options.outputRoot, "engine-execution-report.json", canonicalJson(report));
		} });
		await assert.rejects(() => analyzeCompilerProject(root, { runner: replay, environment }));
		await assert.rejects(() => readdir(staging), { code: "ENOENT" });
	}
	await cp(root, join(directory, "relocated"), { recursive: true });
	assert.deepEqual(await analyzeCompilerProject(join(directory, "relocated"), { runner: transport(), environment }), analysis);
	assert.deepEqual(await lakeInputState(root), before);
	t.diagnostic(JSON.stringify({ reviewed, exports: model.declarations.length, compilerOnly: true, relocated: true, authenticatedMutationRejections: 11 }));
});

test("ownership analysis keeps unknown versions and conflicting author decisions closed", async t => {
	const { root } = await fixture(t, true);
	const runner = { capture: () => assert.fail("Invalid review must not invoke a compiler") };
	const review = ownedDotnetCallbacksReviewedIr(); review.schemaVersion = 5;
	await saveLakeFile(root, "reviewed.binding-ir.json", canonicalJson(review));
	await assert.rejects(() => analyzeCompilerProject(root, { runner, environment }), { code: "unsupported-schema" });
	await saveLakeFile(root, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Owned"], resources: ["Owned.Ticket"] }));
	await assert.rejects(() => analyzeCompilerProject(root, { runner, environment }), { code: "export-configuration-reviewed-ir" });
});

test("an owned review cannot replace freshly compiled field order", { skip: !enabled, timeout: 300000 }, async t => {
	const { root } = await fixture(t, true), review = ownedDotnetCallbacksReviewedIr();
	review.types.find(type => type.name === "Bundle").fields.reverse();
	await saveLakeFile(root, "reviewed.binding-ir.json", canonicalJson(review));
	const before = await lakeInputState(root);
	const result = await runCli({ argv: ["analyze", "--project", root, "--json"], handlers: handlers(transport()) });
	assert.equal(result.response.status, "blocked");
	assert.equal(result.response.diagnostics[0].code, "reviewed-ir-source-mismatch", JSON.stringify(result.response));
	assert.equal(result.response.result, null);
	assert.deepEqual(await lakeInputState(root), before);
});

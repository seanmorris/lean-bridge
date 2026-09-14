/**
 * Check source-only CLI analysis and its compiler-owned, read-only engine boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { analyzeCompilerProject } from "../src/analyze/compiler-analysis.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { validateCompilerProjectAnalysis } from "../src/analyze/project-analysis.mjs";
import { builtinAnalysisPolicyRecord, evaluateAnalysisPolicy } from "../src/analyze/policy.mjs";
import { createCliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { createEngineExecutionRequest, validateEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { prepareLakeEntryIntent, readLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { prepareLakeDependencySnapshot, readLakeDependencySnapshot, verifyLakeSnapshotProject } from "../src/build/lake-dependency-snapshot.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { customLakeRoot, elaboratedLakeApi, lakeInputState, lakeWorkspaceFixture, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { generatedLakeEntryFixture } from "./helpers/lake-generator.mjs";

const enabled = process.env.LEAN_BRIDGE_COMPILER_ANALYSIS_TEST === "1";
const engineRoot = process.cwd();
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix" };
const fixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-compiler-analysis-test-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/onboarding/small", root, { recursive: true });
	return { directory, root };
};
const transport = ({ execute, after, compiler = processBuildRunner } = {}) => ({ capture: async command => {
	if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
	if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
	const arg = name => command.args[command.args.indexOf(name) + 1];
	const options = { requestPath: arg("--request"), inputRoot: arg("--component"), outputRoot: arg("--output"), engineRoot: arg("--engine"), backend: "native-nix", signal: command.signal, runner: compiler };
	assert.equal(arg("--backend"), "native-nix");
	const request = JSON.parse(await readFile(options.requestPath, "utf8"));
	assert.equal(request.schemaVersion, 3);
	assert.equal(request.policies.noAdapterCompilation, true);
	if(execute) await execute(options, command);
	else await executeComponentEngineRequest(options);
	await after?.(options);
	return { stdout: "", stderr: "", code: 0 };
} });
const handlers = runner => createCliHandlers({ analyze: (root, options) => analyzeCompilerProject(root, { ...options, runner, environment }) });
const strictPolicy = analysis => evaluateAnalysisPolicy({ analysis
	, policyRecord: { ...builtinAnalysisPolicyRecord()
		, document: { ...builtinAnalysisPolicyRecord().document, requireCompiledExports: true, allowStaticallyInferredIr: false } }
	, policyPath: null });

test("analysis intent captures absent lockfiles, relocates, and authorizes no semantic inputs or packages", async t => {
	const { directory, root } = await fixture(t);
	const before = await lakeInputState(root);
	await assert.rejects(() => prepareLakeDependencySnapshot({ projectRoot: root, includeProject: true }));
	const intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis" });
	assert.equal(intent.lakeSnapshot.document.schemaVersion, 3);
	assert.equal(intent.lakeSnapshot.document.rootInputs.some(file => file.path === "lake-manifest.json"), false);
	await assertJsonSchema("lake-dependency-snapshot", intent.lakeSnapshot.document);
	await assertJsonSchema("lake-entry-intent", intent.document);
	const inputs = join(directory, "inputs");
	await writeLakeEntryInputs({ intent, outputRoot: inputs });
	const read = await readLakeEntryIntent({ inputRoot: inputs, expectedSha256: intent.sha256, purpose: "analysis" });
	assert.equal(read.sha256, intent.sha256);
	await assert.rejects(() => readLakeEntryIntent({ inputRoot: inputs, expectedSha256: intent.sha256 }), /Unsupported public entry intent/);
	const request = await createEngineExecutionRequest({ engineRoot, inputRoot: inputs, entryIntent: intent, purpose: "analysis", targets: ["npm", "cpan"] });
	await assertJsonSchema("engine-execution-request", request.document);
	assert.deepEqual(request.document.output.authorizedFiles, ["project-analysis.json"]);
	assert.equal(request.document.policies.noAdapterCompilation, true);
	for(const change of [
		value => { value.component.compilationPlanSha256 = "0".repeat(64); }
		, value => { value.output.authorizedFiles.push("module.wasm"); }
		, value => { value.policies.compileOnce = true; }
		, value => { value.policies.noAdapterCompilation = false; }
	]) {
		const invalid = structuredClone(request.document); change(invalid);
		assert.throws(() => validateEngineExecutionRequest(invalid));
	}
	await cp(root, join(directory, "moved"), { recursive: true });
	assert.equal((await prepareLakeEntryIntent({ projectRoot: join(directory, "moved"), purpose: "analysis" })).sha256, intent.sha256);
	assert.deepEqual(await lakeInputState(root), before);
	await writeFile(join(inputs, "invented-metadata.json"), "{}");
	await assert.rejects(() => readLakeEntryIntent({ inputRoot: inputs, expectedSha256: intent.sha256, purpose: "analysis" }), /cannot supply adapters/);
	await writeFile(join(root, "lake-manifest.json"), '{"version":"1.2.0","packages":[]}');
	await assert.rejects(() => verifyLakeSnapshotProject({ projectRoot: root, snapshot: intent.lakeSnapshot }));
	const snapshotRoot = join(inputs, "lake");
	await writeFile(join(snapshotRoot, "root/lake-manifest.json"), '{}');
	await assert.rejects(() => readLakeDependencySnapshot({ snapshotRoot, expectedSha256: intent.lakeSnapshot.sha256 }));
});

test("reviewed Binding IR works without a compiler and ignores cached source claims", async t => {
	const { root } = await fixture(t);
	const ir = await readFile("poc/lean-link-spike/bindings/alpha.binding-ir.json");
	await writeFile(join(root, "reviewed.binding-ir.json"), ir);
	await saveLakeFile(root, ".lake/build/lib/lean/OnboardingSmall.ilean", '{"module":"Forged","decls":{"Forged.theorem":[]}}');
	const before = await lakeInputState(root);
	const runner = { capture: () => assert.fail("Reviewed IR must not start a backend") };
	const report = await analyzeCompilerProject(root, { runner });
	await assertJsonSchema("project-analysis", report);
	assert.equal(report.bindingIr.origin, "existing-validated");
	assert.equal(report.compiledEnvironment.status, "absent");
	assert.equal(report.elaboration, null);
	assert.deepEqual(report.declarations, []);
	assert.ok(report.exportCandidates.every(item => item.confidence === "reviewed-ir" && !item.theoremCandidates.length));
	assert.equal(strictPolicy(report).passed, false);
	assert.deepEqual(await lakeInputState(root), before);
	await writeFile(join(root, "second.binding-ir.json"), ir);
	const multiple = await analyzeCompilerProject(root, { runner });
	await assertJsonSchema("project-analysis", multiple);
	assert.equal(multiple.bindingIr, null);
	assert.equal(multiple.adapterHints[0].reason, "multiple-binding-ir-documents");
	await saveLakeFile(root, "lean-bridge.exports.json", '{"schemaVersion":1,"modules":["OnboardingSmall"]}');
	await assert.rejects(() => analyzeCompilerProject(root, { runner }), { code: "export-configuration-reviewed-ir" });
});

test("missing compiler backends block CLI analysis without a source-scanner fallback", async t => {
	const { directory, root } = await fixture(t);
	const before = await lakeInputState(root), output = join(directory, "analysis");
	const runner = { capture: async () => { throw Object.assign(new Error("Tool is absent"), { code: "ENOENT" }); } };
	const result = await runCli({ argv: ["analyze", "--project", root, "--output", output, "--json"], handlers: handlers(runner) });
	assert.equal(result.exitCode, 2);
	assert.equal(result.response.status, "blocked");
	assert.equal(result.response.result, null);
	assert.ok(result.response.diagnostics.some(item => item.code === "nix-unavailable"));
	await assert.rejects(() => readdir(output), { code: "ENOENT" });
	assert.deepEqual(await lakeInputState(root), before);
});

test("engine errors, malformed output, and cancellation preserve sources and remove owned staging", async t => {
	const { root } = await fixture(t);
	const before = await lakeInputState(root);
	for(const mode of ["failure", "malformed", "cancel", "symlink"])
	{
		const controller = new AbortController(), reason = new Error("Stop compiler analysis");
		let staging;
		const runner = transport({ execute: async options => {
			staging = dirname(options.inputRoot);
			if(mode === "cancel")
			{ controller.abort(reason); throw reason; }
			if(mode === "failure") throw Object.assign(new Error("Compiler invocation failed"), { code: "build-command-failed", details: { stderr: "Fixture.lean:1:0: unknown identifier" } });
			await mkdir(join(options.outputRoot, "analysis"), { recursive: true });
			await writeFile(join(options.outputRoot, "engine-execution-report.json"), "{}");
			if(mode === "symlink") await symlink(join(root, "lakefile.toml"), join(options.outputRoot, "analysis/project-analysis.json"));
			else await writeFile(join(options.outputRoot, "analysis/project-analysis.json"), "{");
		} });
		if(mode === "cancel") await assert.rejects(() => analyzeCompilerProject(root, { runner, environment, signal: controller.signal }), error => error === reason);
		else
		{
			const result = await runCli({ argv: ["analyze", "--project", root, "--json"], handlers: handlers(runner) });
			assert.equal(result.exitCode, 1);
			assert.equal(result.response.result, null);
			if(mode === "failure") assert.match(result.response.diagnostics[0].message, /unknown identifier/);
		}
		await assert.rejects(() => readdir(staging), { code: "ENOENT" });
		assert.deepEqual(await lakeInputState(root), before);
	}
});

test("real compiler analyzes a new package without creating a lock or trusting cached interfaces", { skip: !enabled }, async t => {
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, ".lake/build/lib/lean/OnboardingSmall.ilean", '{"module":"Forged","decls":{"Forged.theorem":[]}}');
	const before = await lakeInputState(root);
	const compiler = { capture: command => {
		assert.equal(command.command.endsWith("/lean"), true, "Analysis must not invoke emcc, linkers or generated adapters");
		assert.equal(command.args.includes("-c"), false);
		return processBuildRunner.capture(command);
	} };
	let released;
	const runner = transport({ compiler
		, after: async options => {
		released = { analysis: await readFile(join(options.outputRoot, "analysis/project-analysis.json")), report: await readFile(join(options.outputRoot, "engine-execution-report.json")) };
		}
	});
	const result = await runCli({ argv: ["analyze", "--project", root, "--check", "--output", join(directory, "analysis"), "--json"], handlers: handlers(runner) });
	assert.equal(result.exitCode, 0, JSON.stringify(result.response.diagnostics));
	const analysis = result.response.result;
	await assertJsonSchema("project-analysis", analysis);
	assert.equal(analysis.schemaVersion, 2);
	assert.equal(analysis.bindingIr.origin, "lean-elaborated");
	assert.equal(strictPolicy(analysis).passed, true);
	await assertJsonSchema("analysis-policy-report", strictPolicy(analysis));
	const cached = structuredClone(analysis);
	cached.exportCandidates.forEach(candidate => { candidate.evidence = ["compiled-interface:present"]; });
	assert.equal(strictPolicy(cached).passed, false);
	for(const category of ["extractor-failure", "stale-metadata"])
	{
		const fault = structuredClone(analysis);
		fault.bindingIr = null;
		fault.diagnostics.push({ code: "invalid-extractor-result", severity: "error", category, message: "Injected extraction fault", path: null, hint: null });
		const failed = await runCli({ argv: ["analyze", "--project", root, "--json"], handlers: createCliHandlers({ analyze: async () => fault }) });
		assert.equal(failed.exitCode, 1);
		assert.equal(failed.response.status, "failed");
	}
	assert.equal(analysis.declarations.some(item => item.name.startsWith("Forged")), false);
	assert.deepEqual(await lakeInputState(root), before);
	assert.deepEqual(JSON.parse(await readFile(join(directory, "analysis/project-analysis.json"), "utf8")), analysis);
	const inventory = await inspectLeanProject(root), intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis" });
	for(const change of [
		value => { value.elaboration.extra = true; }
		, value => { value.elaboration.request.metadata.invocationIdentitySha256 = "0".repeat(64); }
		, value => { value.elaboration.request.exportModules = ["Forged"]; }
		, value => { value.elaboration.interfaces[0].interfaceSha256 = "0".repeat(64); }
		, value => { value.elaboration.request.metadata.modules[0].sourceSha256 = "0".repeat(64); }
		, value => { value.elaboration.leanCompilerSha256 = "0".repeat(64); }
		, value => { value.bindingIr.document.declarations[0].parameters[0].type.name = "string"; }
	]) {
		const invalid = structuredClone(analysis); change(invalid);
		assert.throws(() => validateCompilerProjectAnalysis(invalid, inventory, intent), { code: "invalid-compiler-analysis" });
	}
	const replay = change => transport({ execute: async options => {
		const report = JSON.parse(released.report), value = JSON.parse(released.analysis);
		change(value, report);
		const bytes = canonicalJson(value); report.analysisSha256 = sha256(bytes);
		await mkdir(join(options.outputRoot, "analysis"), { recursive: true });
		await writeFile(join(options.outputRoot, "analysis/project-analysis.json"), bytes);
		await writeFile(join(options.outputRoot, "engine-execution-report.json"), canonicalJson(report));
	} });
	for(const change of [
		value => { value.bindingIr.semanticSha256 = "0".repeat(64); }
		, (_value, report) => { report.backend = "docker-nix"; }
		, (_value, report) => { report.adaptersCompiled = true; }
	]) await assert.rejects(() => analyzeCompilerProject(root, { runner: replay(change), environment }), { code: "invalid-compiler-analysis" });
});

test("real compiler analysis binds finite selections to source intent and rejects substituted types", { skip: !enabled }, async t => {
	const { root, directory } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", "universe u\n/-- Double a selected concrete value. -/\ndef OnboardingSmall.twice {α : Type u} [Add α] (value : α) : α := value + value\n");
	const specializations = [{ name: "OnboardingSmall.twiceWord", declaration: "OnboardingSmall.twice", types: ["UInt32"] }];
	const contracts = { "OnboardingSmall.twiceWord": { parameters: [{ ownership: "copy", lifetime: null }], effects: [] } };
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: ["OnboardingSmall.twiceWord"], specializations, contracts }));
	const before = await lakeInputState(root);
	const first = await analyzeCompilerProject(root, { runner: transport(), environment });
	await assertJsonSchema("project-analysis", first);
	assert.deepEqual(first.adapterHints, [], JSON.stringify(first.diagnostics));
	assert.deepEqual(first.proposedExports, ["lean:OnboardingSmall.twiceWord"]);
	assert.equal(first.bindingIr.document.declarations[0].parameters[0].type.name, "uint32");
	assert.equal(first.bindingIr.document.declarations[0].source.declaration, "OnboardingSmall.twice");
	assert.deepEqual(first.bindingIr.document.declarations[0].source.extensions["lean-lang.org/export-contract"], contracts["OnboardingSmall.twiceWord"]);
	const inventory = await inspectLeanProject(root), intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis" });
	for(const change of [
		value => { value.elaboration.request.specializations[0].types = ["Nat"]; }
		, value => { delete value.elaboration.request.specializations; }
		, value => { delete value.elaboration.request.contracts; }
		, value => { value.elaboration.request.contracts["OnboardingSmall.twiceWord"].effects = ["async"]; }
		, value => { delete value.bindingIr.document.declarations[0].source.extensions["lean-lang.org/export-contract"]; }
		, value => { value.bindingIr.document.declarations[0].source.extensions["lean-lang.org/specialization"].application = "id"; }
	]) {
		const invalid = structuredClone(first); change(invalid);
		assert.throws(() => validateCompilerProjectAnalysis(invalid, inventory, intent));
	}
	await cp(root, join(directory, "moved"), { recursive: true });
	assert.deepEqual(await analyzeCompilerProject(join(directory, "moved"), { runner: transport(), environment }), first);
	assert.deepEqual(await lakeInputState(root), before);
});

for(const variant of ["shop", "telemetry"]) test(`real compiler analysis preserves ${variant} aliases, custom paths and locked dependencies after relocation`, { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t, variant), path = await customLakeRoot(context);
	await elaboratedLakeApi(context, path);
	const before = await lakeInputState(context.workspace), runner = transport();
	const first = await analyzeCompilerProject(context.root, { runner, environment });
	await assertJsonSchema("project-analysis", first);
	assert.equal(first.bindingIr.document.declarations[0].parameters[0].type.name, "uint32");
	assert.equal(first.exportCandidates[0].path, path);
	assert.equal(first.elaboration.metadata.modules.length, 3);
	await cp(context.workspace, join(context.directory, "moved"), { recursive: true });
	const moved = await analyzeCompilerProject(join(context.directory, "moved/project"), { runner, environment });
	assert.equal(canonicalJson(first), canonicalJson(moved));
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("real compiler returns unsupported meaning as reviewable diagnostics, without an adapter build", { skip: !enabled }, async t => {
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", `namespace OnboardingSmall
abbrev Word := UInt32
/-- Keep a value. -/
def keep (value : Word) : Word := value
theorem keep_eq (value : Word) : keep value = value := rfl
def fetch : IO Word := pure 1
def implicit {value : Word} : Word := value
end OnboardingSmall
`);
	const before = await lakeInputState(root), output = join(directory, "unsupported");
	const result = await runCli({ argv: ["analyze", "--project", root, "--output", output, "--json"], handlers: handlers(transport()) });
	assert.equal(result.exitCode, 2, JSON.stringify(result.response.diagnostics));
	assert.equal(result.response.status, "needs-input");
	await assertJsonSchema("project-analysis", result.response.result);
	assert.ok(result.response.result.diagnostics.some(item => item.category === "unsupported-meaning" && item.code === "unsupported-effect"));
	assert.ok(result.response.result.diagnostics.some(item => item.code === "implicit-parameter"));
	assert.deepEqual(result.response.result.exportCandidates.find(item => item.declaration === "OnboardingSmall.keep").theoremCandidates, ["OnboardingSmall.keep_eq"]);
	assert.deepEqual(result.response.result.bindingIr.document.assurance, []);
	assert.deepEqual(JSON.parse(await readFile(join(output, "project-analysis.json"), "utf8")), result.response.result);
	assert.deepEqual(await lakeInputState(root), before);
});

test("real Lake rejects unreviewed dependency resolution without writing a lock", { skip: !enabled }, async t => {
	const { root } = await fixture(t);
	await saveLakeFile(root, "lakefile.toml", 'name = "unlocked"\n[[require]]\nname = "Missing"\npath = "../absent"\n[[lean_lib]]\nname = "OnboardingSmall"\n');
	const before = await lakeInputState(root);
	await assert.rejects(() => analyzeCompilerProject(root, { runner: transport(), environment }), error => /Create and review lake-manifest.json/.test(JSON.stringify(error.details)));
	assert.deepEqual(await lakeInputState(root), before);
});

test("cancelled subprocesses finish cleanup before the runner releases their workspace", async t => {
	const { directory } = await fixture(t), controller = new AbortController();
	const ready = join(directory, "ready"), finished = join(directory, "finished");
	const script = `const fs = require('node:fs');
process.on('SIGTERM', () => setTimeout(() => { fs.writeFileSync(process.argv[2], 'done'); process.exit(0); }, 100));
fs.writeFileSync(process.argv[1], 'ready'); setInterval(() => {}, 1000);`;
	const operation = processBuildRunner.capture({ command: process.execPath, args: ["-e", script, ready, finished], cwd: directory, signal: controller.signal });
	const rejected = assert.rejects(operation, { code: "build-cancelled" });
	try
	{
		for(let attempts = 0; attempts <= 251; attempts++)
		{
			try
			{ await readFile(ready); break; }
			catch(error)
			{ if(error.code !== "ENOENT" || attempts > 250) throw error; }
			await delay(20);
		}
		controller.abort(new Error("Stop"));
		await rejected;
		assert.equal(await readFile(finished, "utf8"), "done");
	} finally
	{ controller.abort(); await rejected; }
});

test("a relocated CLI archive analyzes with its own engine and needs no bundled Wasm runtime", { skip: !enabled }, async t => {
	const { directory, root } = await fixture(t);
	const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "candidate") });
	const installed = join(directory, "relocated-cli");
	await cp(candidate.directory, installed, { recursive: true });
	const { analyzeCompilerProject: analyzeInstalled } = await import(pathToFileURL(join(installed, "src/analyze/compiler-analysis.mjs")));
	const { executeComponentEngineRequest: executeInstalled } = await import(pathToFileURL(join(installed, "src/build/component-engine.mjs")));
	const lean = join(engineRoot, ".toolchains/elan/bin/lean");
	const prefix = (await processBuildRunner.capture({ command: lean, args: ["--print-prefix"], cwd: root })).stdout.trim();
	const before = await lakeInputState(installed);
	const runner = transport({ execute: options => {
		assert.equal(options.engineRoot, installed);
		return executeInstalled({ ...options, environment: { ...process.env, LEAN_BRIDGE_LEAN: join(prefix, "bin/lean") } });
	} });
	const report = await analyzeInstalled(root, { runner, environment });
	await assertJsonSchema("project-analysis", report);
	assert.equal(report.bindingIr.origin, "lean-elaborated");
	assert.deepEqual(await lakeInputState(installed), before);
});

test("real generated public entry analysis runs captured recipes without author-tree output", { skip: !enabled, timeout: 600000 }, async t => {
	const context = await generatedLakeEntryFixture(t);
	const before = await lakeInputState(context.workspace);
	const report = await analyzeCompilerProject(context.root, { runner: transport(), environment });
	await assertJsonSchema("project-analysis", report);
	assert.equal(report.exportCandidates[0].path, "generated/Shop.lean");
	assert.equal(report.bindingIr.document.declarations[0].parameters[0].type.name, "uint32");
	assert.match(report.elaboration.generatedSourcesSha256, /^[a-f0-9]{64}$/);
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("compiler-time cancellation and dependency drift release no report", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t), before = await lakeInputState(context.workspace);
	const controller = new AbortController(), reason = new Error("Cancel fresh interface compilation");
	let staging;
	const compiler = { capture: async command => {
		if(command.args.includes("-o"))
		{ controller.abort(reason); throw reason; }
		return processBuildRunner.capture(command);
	} };
	const runner = transport({ execute: options => { staging = dirname(options.inputRoot); return executeComponentEngineRequest(options); }, compiler });
	await assert.rejects(() => analyzeCompilerProject(context.root, { runner, environment, signal: controller.signal }), error => error === reason);
	await assert.rejects(() => readdir(staging), { code: "ENOENT" });
	assert.deepEqual(await lakeInputState(context.workspace), before);
	const drift = transport({ after: async options => {
		staging = dirname(options.inputRoot);
		await saveLakeFile(context.local, "Catalog.lean", "import Units\ndef Catalog.quote (value : UInt32) := Units.convert value + 99\n");
	} });
	await assert.rejects(() => analyzeCompilerProject(context.root, { runner: drift, environment }), /changed|drift/);
	await assert.rejects(() => readdir(staging), { code: "ENOENT" });
});

test("analysis reports configured resources and closure arities instead of ignoring them", { skip: !enabled }, async t => {
	const { root } = await fixture(t);
	await saveLakeFile(root, "lean-bridge.exports.json", JSON.stringify({ schemaVersion: 1
		, exports: ["OnboardingSmall.add"]
		, resources: ["OnboardingSmall.Handle"]
		, arities: { "OnboardingSmall.add": 1 } }));
	const before = await lakeInputState(root);
	const result = await runCli({ argv: ["analyze", "--project", root, "--json"], handlers: handlers(transport()) });
	assert.equal(result.exitCode, 2);
	await assertJsonSchema("project-analysis", result.response.result);
	assert.equal(result.response.result.bindingIr, null);
	assert.deepEqual(result.response.result.proposedExports, []);
	assert.equal(result.response.result.diagnostics.filter(item => item.code === "analysis-configuration-unsupported").length, 2);
	assert.deepEqual(await lakeInputState(root), before);
});

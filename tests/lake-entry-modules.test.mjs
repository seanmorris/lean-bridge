/**
 * Public generator outputs are compiler-free intent, never inferred signatures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { chmod, lstat, mkdir, open, readFile, readdir, rm, symlink } from "node:fs/promises";
import { analyzeLeanProject, inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { selectLakeEntryModules, verifyLakeEntryModules } from "../src/build/lake-entry-modules.mjs";
import { generatedLakeEntryFixture } from "./helpers/lake-generator.mjs";
import { elaboratedLakeApi, lakeInputState, lakeWorkspaceFixture } from "./helpers/lake-workspace.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createEngineExecutionRequest, validateEngineExecutionRequest, writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { prepareLakeEntryIntent, readLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { createLakeEntryAnalysis } from "../src/build/lake-entry-elaboration.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { createComponentBuildPlan, prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { createComponentCompilationPlan, prepareComponentCompilationPlan, validateComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

/**
 * Tamper with an owned read-only fixture, restoring its mode before validation.
 *
 * @param root - Isolated fixture directory.
 * @param path - Relative record filename.
 * @param bytes - Forged record contents.
 */
const tamperReadOnlyRecord = async (root, path, bytes) => {
	const target = join(root, path);
	assert.equal((await lstat(target)).mode & 0o777, 0o444);
	await chmod(target, 0o644);
	try
	{ await saveLakeFile(root, path, bytes); }
	finally
	{ await chmod(target, 0o444); }
};

test("public generator outputs can be selected without executing Lean or assigning types", async t => {
	const context = await generatedLakeEntryFixture(t);
	const before = await lakeInputState(context.workspace);
	const inspected = await inspectLeanProject(context.root);
	assert.equal(inspected.bindingIr, undefined);
	assert.equal(inspected.inputs.some(input => input.path.endsWith("/Shop.lean") || input.path === "Shop.lean"), false);
	const entries = selectLakeEntryModules(context.configuration, inspected.inputs);
	assert.deepEqual(entries, [{ module: "Shop", path: "generated/Shop.lean", origin: { kind: "generated", generator: "root/table" } }]);
	assert.deepEqual(await lakeInputState(context.workspace), before);
	for(const [configuration, inputs, code] of [
		[{ ...context.configuration, modules: ["NotDeclared"] }, inspected.inputs, "unknown-export-module"]
		, [context.configuration, inspected.inputs.filter(input => input.path !== "lake-manifest.json"), "generated-entry-lock-required"]
		, [context.configuration, [...inspected.inputs, { path: "generated/Shop.lean", bytes: 0, sha256: "0".repeat(64) }], "ambiguous-export-module"]
		, [context.configuration, [...inspected.inputs, { path: "Shop.lean", bytes: 0, sha256: "0".repeat(64) }], "ambiguous-export-module"]
		, [{ ...context.configuration, modules: ["Shop", "generated.Shop"] }, inspected.inputs, "ambiguous-export-module"]
	]) assert.throws(() => selectLakeEntryModules(configuration, inputs), { code });
	const configuration = structuredClone(context.configuration);
	configuration.generators[1].outputs = [{ name: "lean", path: "other/Shop.lean" }];
	assert.throws(() => selectLakeEntryModules(configuration, inspected.inputs), { code: "ambiguous-export-module" });
});

test("ordinary locked modules carry source-only intent without host type inference", async t => {
	const context = await lakeWorkspaceFixture(t);
	await elaboratedLakeApi(context);
	const before = await lakeInputState(context.workspace);
	const intent = await prepareLakeEntryIntent({ projectRoot: context.root });
	assert.equal(intent.document.schemaVersion, 2);
	assert.equal(intent.document.modules[0].origin.kind, "captured");
	await assertJsonSchema("lake-entry-intent", intent.document);
	const inputRoot = join(context.directory, "inputs");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const request = await createEngineExecutionRequest({ engineRoot: process.cwd(), inputRoot, entryIntent: intent, targets: ["npm"] });
	assert.equal(request.document.schemaVersion, 2);
	assert.equal(request.document.output.authorizedFiles.includes("generated/lake-generated-sources.json"), false);
	assert.ok(request.document.output.authorizedFiles.includes("metadata/lake-entry-exports.json"));
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("unlocked module hints allow custom paths but reject ambiguous and partial suffixes", () => {
	const input = { path: "lib/Shop/Api.lean", bytes: 12, sha256: "a".repeat(64) };
	const entries = selectLakeEntryModules({ schemaVersion: 1, modules: ["Shop.Api"] }, [input]);
	assert.deepEqual(entries, [{ ...input, module: "Shop.Api", origin: { kind: "captured" } }]);
	for(const [modules, inputs, code] of [
		[["hop.Api"], [input], "unknown-export-module"]
		, [["Shop.Api"], [input, { ...input, path: "Shop/Api.lean" }], "ambiguous-export-module"]
		, [["Shop.Api", "Api"], [input], "ambiguous-export-module"]
	]) assert.throws(() => selectLakeEntryModules({ schemaVersion: 1, modules }, inputs), { code });
	assert.throws(() => verifyLakeEntryModules(entries, { modules: [{ module: "Shop.Api", path: "root/another/Shop/Api.lean", source: input }] }), { code: "lake-entry-source-drift" });
});

test("resolved public roots must preserve the planned file and producing generator", () => {
	const source = { bytes: 12, sha256: "a".repeat(64), origin: { kind: "generated", generator: "root/table", receiptSha256: "b".repeat(64) } };
	const entry = { module: "Shop", path: "generated/Shop.lean", origin: { kind: "generated", generator: "root/table" } };
	const resolution = { modules: [{ module: "Shop", path: "root/generated/Shop.lean", source }] };
	assert.deepEqual(verifyLakeEntryModules([entry], resolution), [{ ...entry, ...source }]);
	for(const change of [
		value => { value.modules = []; }
		, value => { value.modules[0].path = "packages/Other/generated/Shop.lean"; }
		, value => { value.modules[0].source.origin.kind = "captured"; }
		, value => { value.modules[0].source.origin.generator = "root/other"; }
	]) {
		const invalid = structuredClone(resolution); change(invalid);
		assert.throws(() => verifyLakeEntryModules([entry], invalid), { code: "lake-entry-source-drift" });
	}
	const captured = { ...entry, bytes: source.bytes, sha256: source.sha256, origin: { kind: "captured" } };
	const original = { modules: [{ module: "Shop", path: "root/generated/Shop.lean", source: { bytes: source.bytes, sha256: source.sha256 } }] };
	assert.doesNotThrow(() => verifyLakeEntryModules([captured], original));
	original.modules[0].source.bytes++;
	assert.throws(() => verifyLakeEntryModules([captured], original), { code: "lake-entry-source-drift" });
});

test("generated source intent survives detached staging and rejects recomputed forgeries", async t => {
	const context = await generatedLakeEntryFixture(t);
	const before = await lakeInputState(context.workspace);
	const intent = await prepareLakeEntryIntent({ projectRoot: context.root });
	await assertJsonSchema("lake-entry-intent", intent.document);
	const inputRoot = join(context.directory, "input");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const checked = await readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256 });
	assert.deepEqual(checked.document, intent.document);
	const request = await createEngineExecutionRequest({ engineRoot: process.cwd(), inputRoot, entryIntent: intent, targets: ["npm"] });
	assert.equal(request.document.schemaVersion, 2);
	assert.equal(request.document.component.componentPlanSha256, undefined);
	assert.ok(request.document.output.authorizedFiles.includes("metadata/lake-entry-exports.json"));
	await assertJsonSchema("engine-execution-request", request.document);
	const invalid = structuredClone(request.document);
	invalid.component.componentPlanSha256 = "0".repeat(64);
	assert.throws(() => validateEngineExecutionRequest(invalid));
	await assert.rejects(() => assertJsonSchema("engine-execution-request", invalid));
	await assert.rejects(() => createEngineExecutionRequest({ engineRoot: process.cwd(), inputRoot, entryIntent: intent, componentPlan: {}, targets: ["npm"] }));
	await assert.rejects(() => createEngineExecutionRequest({ engineRoot: process.cwd(), inputRoot, entryIntent: intent, targets: ["cpan"] }));
	for(const change of [
		value => { value.modules[0].path = "outside/Shop.lean"; }
		, value => { value.modules[0].origin.generator = "root/unused"; }
		, value => { value.component.name = "AnotherPackage"; }
		, value => { value.source.treeSha256 = "0".repeat(64); }
		, value => { value.bindingIr = {}; }
	]) {
		const document = structuredClone(intent.document); change(document);
		await tamperReadOnlyRecord(inputRoot, "lake-entry-intent.json", canonicalJson(document));
		await assert.rejects(() => readLakeEntryIntent({ inputRoot, expectedSha256: sha256(canonicalJson(document)) }));
	}
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("generated entry planning runs with Git but no host Lean or Lake executable", async t => {
	const context = await generatedLakeEntryFixture(t), before = await lakeInputState(context.workspace);
	const expected = await prepareLakeEntryIntent({ projectRoot: context.root });
	const bin = join(context.directory, "only-git");
	await mkdir(bin);
	await symlink("/usr/bin/git", join(bin, "git"));
	const module = pathToFileURL(resolve("src/build/lake-entry-intent.mjs")).href;
	const script = `import {prepareLakeEntryIntent} from ${JSON.stringify(module)};
console.log((await prepareLakeEntryIntent({projectRoot:process.argv[1]})).sha256);`;
	const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script, context.root], { env: { PATH: bin, LANG: "C.UTF-8" } });
	assert.equal(result.stdout.trim(), expected.sha256);
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("entry input transport rejects occupied outputs, extra files, symlinks, oversized records and cancellation", async t => {
	const context = await generatedLakeEntryFixture(t), intent = await prepareLakeEntryIntent({ projectRoot: context.root });
	const inputRoot = join(context.directory, "inputs"), occupied = join(context.directory, "occupied");
	await mkdir(occupied);
	const before = await lstat(occupied);
	await assert.rejects(() => writeLakeEntryInputs({ intent, outputRoot: occupied }), { code: "invalid-lake-entry-intent" });
	assert.equal((await lstat(occupied)).ino, before.ino);
	const signal = AbortSignal.abort();
	await assert.rejects(() => writeLakeEntryInputs({ intent, outputRoot: inputRoot, signal }), { name: "AbortError" });
	await assert.rejects(() => lstat(inputRoot), { code: "ENOENT" });
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const read = () => readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256 });
	await assert.rejects(() => readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256, signal }), { name: "AbortError" });
	await saveLakeFile(inputRoot, "binding-ir.json", "{}");
	await assert.rejects(read, /cannot supply adapters/);
	await rm(join(inputRoot, "binding-ir.json"));
	const path = join(inputRoot, "lake-entry-intent.json");
	await rm(path);
	await symlink(join(context.root, "lean-bridge.exports.json"), path);
	await assert.rejects(read, /regular file/);
	await rm(path);
	const handle = await open(path, "wx");
	try
	{ await handle.truncate(64 * 1024 * 1024); }
	finally
	{ await handle.close(); }
	await assert.rejects(read, /no larger than 16 MiB/);
	assert.equal((await readdir(context.directory)).some(name => name.startsWith(".lean-bridge-entry-inputs-")), false);
});

test("entry engine rejects forged output authority and source changes before compiler invocation", async t => {
	const context = await generatedLakeEntryFixture(t), intent = await prepareLakeEntryIntent({ projectRoot: context.root });
	const inputRoot = join(context.directory, "inputs"), requestPath = join(context.directory, "request.json"), outputRoot = join(context.directory, "output");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const request = await writeEngineExecutionRequest({ output: requestPath, engineRoot: process.cwd(), inputRoot, entryIntent: intent, targets: ["npm"] });
	const execute = () => executeComponentEngineRequest({ requestPath
		, inputRoot, outputRoot
		, engineRoot: process.cwd()
		, environment: { LEAN_BRIDGE_LEAN: join(context.directory, "must-not-run") }
		, runner: { capture: () => assert.fail("Invalid source intent reached the compiler") } });
	const forged = structuredClone(request.document);
	forged.output.authorizedFiles.push("metadata/host-types.json");
	await tamperReadOnlyRecord(context.directory, "request.json", canonicalJson(forged));
	await assert.rejects(execute, /differs from the requested component or output inventory/);
	await tamperReadOnlyRecord(context.directory, "request.json", canonicalJson(request.document));
	await saveLakeFile(inputRoot, "lake/root/data/value.txt", "999\n");
	await assert.rejects(execute, { code: "lake-snapshot-drift" });
	await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
});

test("legacy host-planned requests cannot relabel source inference as Lean elaboration", async t => {
	const context = await lakeWorkspaceFixture(t), analysis = await analyzeLeanProject(context.root);
	const prepared = await prepareComponentBuildPlan({ projectRoot: context.root, engineRoot: process.cwd(), targets: ["npm"] });
	const document = structuredClone(prepared.document);
	document.bindingIr.origin = "lean-elaborated";
	const componentPlan = { ...prepared, document, sha256: sha256(canonicalJson(document)) };
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot: context.root, analysis, componentPlan, compilerAdapters });
	const inputRoot = join(context.directory, "inputs"), requestPath = join(context.directory, "request.json"), outputRoot = join(context.directory, "output");
	await writeComponentCompilationInputs({ projectRoot: context.root, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
	await writeEngineExecutionRequest({ output: requestPath, engineRoot: process.cwd(), inputRoot, componentPlan, compilationPlan, targets: ["npm"] });
	await assert.rejects(() => executeComponentEngineRequest({ requestPath
		, inputRoot, outputRoot, engineRoot: process.cwd()
		, runner: { capture: () => assert.fail("Forged elaboration origin reached the compiler") } }), { code: "component-engine-analysis-drift" });
});

test("entry lowering requires shared metadata and keeps selected generated roots", async t => {
	const context = await generatedLakeEntryFixture(t), inventory = await inspectLeanProject(context.root);
	const entries = [{ module: "Shop", path: "generated/Shop.lean", bytes: 1, sha256: "a".repeat(64), origin: { kind: "generated", generator: "root/table", receiptSha256: "b".repeat(64) } }];
	const uint32 = { kind: "primitive", name: "uint32" };
	const request = { modules: ["Shop"], exportModules: ["Shop"]
		, exports: ["Shop.quote"], resources: [], arities: []
		, metadata: { toolchain: inventory.project.toolchain
			, invocationIdentitySha256: "c".repeat(64)
			, modules: [{ name: "Shop", sourcePath: entries[0].path, sourceSha256: entries[0].sha256, interfaceSha256: "d".repeat(64) }] } };
	const elaboration = { request
		, metadata: { schemaVersion: 2, kind: "lean-bridge-elaborated-exports"
		, profile: "component-scalars-v1"
		, producer: { adapter: "lean-bridge-elaborator", adapterVersion: 2
			, tool: "Lean", toolVersion: inventory.project.toolVersion
			, toolchain: inventory.project.toolchain
			, invocationIdentitySha256: request.metadata.invocationIdentitySha256 }
		, modules: [{ ...request.metadata.modules[0], directImports: ["Init"]
			, declarations: [{
			identity: "Shop.quote", kind: "definition"
			, visibility: "public", selected: true
			, source: { path: entries[0].path, startLine: 1, startColumn: 0, endLine: 1, endColumn: 50 }
			, documentation: null, typeExpression: "UInt32 → UInt32"
			, parameters: [{ name: "value", binderInfo: "explicit", typeExpression: "UInt32" }]
			, resultExpression: "UInt32"
			, effects: [], theoremReferences: []
			, projection: { status: "supported", bindingShape: "pure-function", parameters: [{ name: "value", type: uint32 }], result: uint32 }
			}]
		}]
		, diagnostics: [] } };
	assert.throws(() => createLakeEntryAnalysis(inventory, entries, { metadata: { schemaVersion: 1, kind: "lean-bridge-native-elaborated-exports", declarations: [] } }), /scalar metadata profile/);
	const analysis = createLakeEntryAnalysis(inventory, entries, elaboration);
	assert.equal(analysis.bindingIr.origin, "lean-elaborated");
	assert.equal(analysis.bindingIr.document.declarations[0].result.type.name, "uint32");
	assert.deepEqual(analysis.bindingIr.document.assurance, []);
	for(const change of [
		value => { value.metadata.modules[0].name = "Units"; }
		, value => { value.metadata.modules[0].declarations.push(value.metadata.modules[0].declarations[0]); }
		, value => { value.metadata.modules[0].declarations[0].projection.result = { kind: "array", element: { kind: "primitive", name: "unknown" } }; }
		, value => { value.metadata.modules[0].declarations[0].projection.result.name = "unknown"; }
		, value => { value.metadata.modules[0].declarations[0].body = "source fallback"; }
	]) {
		const invalid = structuredClone(elaboration); change(invalid);
		assert.throws(() => createLakeEntryAnalysis(inventory, entries, invalid), { code: "invalid-elaborated-metadata" });
	}
	// Selected captured roots remain part of compilation even without public exports.
	const snapshotSha256 = "c".repeat(64);
	const extra = inventory.inputs.find(input => input.path === "Extra.lean");
	analysis.entryModules.push({ ...extra, module: "Extra", origin: { kind: "captured", snapshotSha256 } });
	analysis.elaboration.generatedSourcesSha256 = "d".repeat(64);
	const { runtime } = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json", "utf8"));
	const componentPlan = createComponentBuildPlan({ analysis, runtime, targets: ["npm"], lakeSnapshotSha256: snapshotSha256 });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	assert.deepEqual(compilerAdapters.plan.imports, ["Shop"]);
	const plan = createComponentCompilationPlan({ analysis, componentPlan, compilerAdapters, sourceFiles: {} });
	assert.equal(plan.document.schemaVersion, 4);
	assert.deepEqual(plan.document.source.requestedModules, ["Extra", "Shop"]);
	await assertJsonSchema("component-compilation-plan", plan.document);
	for(const change of [
		value => { delete value.source.elaborationSha256; }
		, value => { value.source.generatedSourcesSha256 = null; }
		, value => { value.source.modules[0].origin.snapshotSha256 = "0".repeat(64); }
		, value => { value.source.modules[1].origin.generator = "packages/Other/tool"; }
		, value => { value.source.modules[1].origin.extra = "unbound"; }
		, value => { value.source.requestedModules = ["Shop"]; }
	]) {
		const invalid = structuredClone(plan.document); change(invalid);
		assert.throws(() => validateComponentCompilationPlan(invalid));
	}
});

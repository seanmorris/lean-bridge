/**
 * Exercise compiler-free planning and transport of locked component sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentBuildPlan, validateComponentBuildPlan } from "../src/build/component-plan.mjs";
import { prepareComponentCompilationPlan, validateComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { createEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { readLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { lakeGit, lakeInputState, lakeWorkspaceFixture, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { prepareCleanComponentSources } from "../src/release/component-reproducibility-gate.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const prepare = async projectRoot => {
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), targets: ["npm"] });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	return { projectRoot, analysis, componentPlan, compilerAdapters, compilationPlan };
};

test("locked WASM input plans bind dependencies without requiring a host Lean compiler", async t => {
	const context = await lakeWorkspaceFixture(t);
	const before = await lakeInputState(context.workspace);
	const prepared = await prepare(context.root);
	assert.equal(prepared.componentPlan.document.schemaVersion, 2);
	assert.equal(prepared.compilationPlan.document.schemaVersion, 2);
	assert.deepEqual(prepared.compilationPlan.document.source.requestedModules, ["Shop"]);
	assert.equal(Object.hasOwn(prepared.compilationPlan.document.source, "compileOrder"), false);
	assert.equal(Object.hasOwn(prepared.compilationPlan.document.source.modules[0], "imports"), false);
	await assertJsonSchema("component-build-plan", prepared.componentPlan.document);
	await assertJsonSchema("component-compilation-plan", prepared.compilationPlan.document);
	const engine = join(context.directory, "empty-engine");
	await saveLakeFile(engine, "poc/lean-link-spike/graph-lock.json", await readFile("poc/lean-link-spike/graph-lock.json"));
	const bin = join(context.directory, "bin");
	await mkdir(bin);
	await symlink("/usr/bin/git", join(bin, "git"));
	const script = `import {prepareComponentBuildPlan} from ${JSON.stringify(pathToFileURL(resolve("src/build/component-plan.mjs")).href)};
const result = await prepareComponentBuildPlan({projectRoot:process.argv[1],engineRoot:process.argv[2],targets:["npm"]});
console.log(result.sha256);`;
	const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script, context.root, engine], {
		env: { PATH: bin, LANG: "C.UTF-8" }
	});
	assert.equal(result.stdout.trim(), prepared.componentPlan.sha256);
	const inputRoot = join(context.directory, "inputs");
	await writeComponentCompilationInputs({ ...prepared, outputRoot: inputRoot });
	const snapshot = await readLakeDependencySnapshot({ snapshotRoot: join(inputRoot, "lake"), expectedSha256: prepared.componentPlan.document.source.lakeSnapshotSha256 });
	assert.deepEqual(snapshot.document, prepared.componentPlan.lakeSnapshot.document);
	const request = await createEngineExecutionRequest({ ...prepared, engineRoot: process.cwd(), inputRoot, targets: ["npm"] });
	assert.ok(request.document.output.authorizedFiles.includes("lake/packages/Units/lib/Units.lean"));
	assert.ok(request.document.output.authorizedFiles.includes("lake/packages/Catalog/lakefile.toml"));
	assert.deepEqual(await lakeInputState(context.workspace), before);
	await cp(context.workspace, join(context.directory, "moved"), { recursive: true });
	const moved = await prepare(join(context.directory, "moved/project"));
	assert.equal(moved.componentPlan.sha256, prepared.componentPlan.sha256);
	assert.equal(moved.compilationPlan.sha256, prepared.compilationPlan.sha256);
});

test("dependency-only edits invalidate component plans and reject stale staging", async t => {
	const context = await lakeWorkspaceFixture(t);
	const before = await prepare(context.root);
	await saveLakeFile(context.local, "Catalog.lean", "import Units\ndef Catalog.quote (value : UInt32) : UInt32 := Units.convert value + 9\n");
	const after = await prepare(context.root);
	assert.equal(before.analysis.sourceTreeSha256, after.analysis.sourceTreeSha256);
	assert.notEqual(before.componentPlan.sha256, after.componentPlan.sha256);
	assert.notEqual(before.compilationPlan.sha256, after.compilationPlan.sha256);
	await assert.rejects(() => writeComponentCompilationInputs({ ...before, outputRoot: join(context.directory, "stale") }), { code: "lake-source-drift" });
});

test("locked plan validators and schemas reject unbound resolution claims", async t => {
	const context = await lakeWorkspaceFixture(t);
	const prepared = await prepare(context.root);
	for(const change of [
		value => { value.source.lakeSnapshotSha256 = "invalid"; }
		, value => { value.source.compileOrder = ["Shop"]; }
		, value => { value.source.requestedModules = []; }
		, value => { value.source.modules[0].imports = ["Catalog"]; }
		, value => { value.schemaVersion = 1; }
	]) {
		const document = structuredClone(prepared.compilationPlan.document);
		change(document);
		assert.throws(() => validateComponentCompilationPlan(document));
		await assert.rejects(() => assertJsonSchema("component-compilation-plan", document));
	}
	const document = structuredClone(prepared.componentPlan.document);
	delete document.source.lakeSnapshotSha256;
	assert.throws(() => validateComponentBuildPlan(document));
	await assert.rejects(() => assertJsonSchema("component-build-plan", document));
});

test("clean release clones share verified immutable dependencies without copying Git caches or requiring their original paths", async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, ".gitignore", ".lake/\n");
	await lakeGit(context.root, "init", "--quiet");
	await lakeGit(context.root, "add", ".");
	await lakeGit(context.root, "commit", "--quiet", "-m", "Locked project");
	const scratchRoot = join(context.directory, "reproduction");
	await mkdir(scratchRoot);
	const prepared = await prepareCleanComponentSources({ projectRoot: context.root, scratchRoot });
	await rm(context.workspace, { recursive: true });
	for(const [index, projectRoot] of prepared.roots.entries())
	{
		const analysis = await analyzeLeanProject(projectRoot);
		const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot: process.cwd(), lakeSnapshot: prepared.lakeSnapshot });
		assert.equal(componentPlan.document.source.lakeSnapshotSha256, prepared.lakeSnapshot.sha256);
		const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
		await writeComponentCompilationInputs({ projectRoot, outputRoot: join(context.directory, `cloned-input-${index}`), analysis, componentPlan, compilerAdapters, lakeSnapshot: prepared.lakeSnapshot });
		assert.equal(await lakeGit(projectRoot, "status", "--porcelain"), "");
	}
	await saveLakeFile(prepared.roots[0], "extra.txt", "not authorized");
	await assert.rejects(() => prepareComponentBuildPlan({ projectRoot: prepared.roots[0], engineRoot: process.cwd(), lakeSnapshot: prepared.lakeSnapshot }), { code: "lake-source-drift" });
});

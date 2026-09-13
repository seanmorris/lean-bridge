/**
 * Build dependency-free npm projects from compiler-owned signatures, without locks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject, processBuildRunner } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { createEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { prepareLakeEntryIntent, readLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { verifyLakeSnapshotProject } from "../src/build/lake-dependency-snapshot.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { runComponentReproducibilityGate } from "../src/release/component-reproducibility-gate.mjs";
import { verifyPublishManifest } from "../src/release/publish-manifest.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { lakeGit, lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { generatedLakeEntryFixture } from "./helpers/lake-generator.mjs";
import { packageReference } from "../scripts/generate-reference-docs.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_WASM_TEST === "1";
const engineRoot = process.cwd();
const externalEngine = process.env.LEAN_BRIDGE_LAKE_ENGINE;
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
const fixture = async (t, source = "tests/fixtures/documentation/lean-author") => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-unlocked-test-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp(source, root, { recursive: true });
	return { directory, root };
};
const json = async path => JSON.parse(await readFile(path, "utf8"));
// Only the Nix command transport is substituted locally. An external engine,
// when selected in CI, executes the actual pinned Nix build environment.
const transport = ({ execute, after, compiler } = {}) => ({ capture: async command => {
	if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
	if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
	const arg = flag => command.args[command.args.indexOf(flag) + 1];
	const requestPath = arg("--request"), inputRoot = arg("--component"), outputRoot = arg("--output");
	assert.equal((await json(requestPath)).schemaVersion, 2, "Ordinary builds must never use host-inferred plans");
	const options = { requestPath, inputRoot, outputRoot, engineRoot: arg("--engine"), backend: "native-nix", runner: compiler };
	if(execute) await execute(options);
	else if(externalEngine) await processBuildRunner.capture({ command: resolve(externalEngine), args: ["--request", requestPath, "--component", inputRoot, "--output", outputRoot, "--backend", "native-nix"], timeoutMs: 180000 });
	else await executeComponentEngineRequest(options);
	await after?.(options);
	return { stdout: "", stderr: "", code: 0 };
} });
const build = (root, outputRoot, runner = transport()) => buildCanonicalProject({ projectRoot: root, outputRoot, engineRoot, environment, targets: ["npm"], runner });

test("unlocked build intent is source-only, relocatable, and records lockfile absence", async t => {
	const { directory, root } = await fixture(t), before = await lakeInputState(root);
	const intent = await prepareLakeEntryIntent({ projectRoot: root });
	assert.equal(intent.lakeSnapshot.document.schemaVersion, 3);
	assert.deepEqual(intent.lakeSnapshot.document.packages, []);
	assert.equal(intent.document.source.inputs.some(input => input.path === "lake-manifest.json"), false);
	await assertJsonSchema("lake-entry-intent", intent.document);
	await assertJsonSchema("lake-dependency-snapshot", intent.lakeSnapshot.document);
	const inputRoot = join(directory, "inputs");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	assert.equal((await readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256 })).sha256, intent.sha256);
	const request = await createEngineExecutionRequest({ engineRoot, inputRoot, entryIntent: intent });
	await assertJsonSchema("engine-execution-request", request.document);
	assert.equal(request.document.schemaVersion, 2);
	assert.equal(request.document.component.componentPlanSha256, undefined);
	assert.ok(request.document.output.authorizedFiles.includes("metadata/lake-entry-exports.json"));
	assert.equal(request.document.output.authorizedFiles.includes("lake/root/lake-manifest.json"), false);
	const moved = join(directory, "moved");
	await cp(root, moved, { recursive: true });
	assert.equal((await prepareLakeEntryIntent({ projectRoot: moved })).sha256, intent.sha256);
	assert.deepEqual(await lakeInputState(root), before);
	await saveLakeFile(root, "lake-manifest.json", '{"version":"1.2.0","packages":[]}');
	await assert.rejects(() => verifyLakeSnapshotProject({ projectRoot: root, snapshot: intent.lakeSnapshot }));
});

test("the public unlocked planner reaches the engine without assigning types or leaving staging", async t => {
	const { directory, root } = await fixture(t);
	// This signature requires elaboration; the host must not reject or infer it.
	await saveLakeFile(root, "OnboardingSmall.lean", "namespace OnboardingSmall\nabbrev Word := UInt64\ndef add (a b : Word) := a + b\nend OnboardingSmall\n");
	const before = await lakeInputState(root), stopped = new Error("stopped at the compiler boundary");
	let calls = 0;
	await assert.rejects(() => build(root, join(directory, "result"), transport({ execute: async options => {
		calls++;
		assert.deepEqual((await readdir(options.inputRoot)).sort(), ["lake", "lake-entry-intent.json"]);
		throw stopped;
	} })), error => error === stopped);
	assert.equal(calls, 1);
	assert.deepEqual(await lakeInputState(root), before);
	assert.deepEqual(await readdir(directory), ["project"]);
});

test("in-project output keeps source capture outside the author checkout", async t => {
	const { root } = await fixture(t);
	const outputRoot = join(root, "build/release"), stopped = new Error("Reached isolated compiler");
	let inputRoot;
	await assert.rejects(() => build(root, outputRoot, transport({ execute: options => {
		inputRoot = options.inputRoot;
		assert.ok(relative(root, inputRoot).startsWith(".."));
		throw stopped;
	} })), error => error === stopped);
	assert.ok(inputRoot);
	assert.deepEqual(await readdir(join(root, "build")), []);
});

test("unwritable release directories do not leak external staging", { skip: process.getuid?.() === 0 || process.platform === "win32" }, async t => {
	const { directory, root } = await fixture(t);
	const scratch = join(directory, "scratch"), destination = join(directory, "readonly");
	await mkdir(scratch); await mkdir(destination);
	const previous = process.env.TMPDIR;
	try
	{
		process.env.TMPDIR = scratch;
		await chmod(destination, 0o555);
		await assert.rejects(() => build(root, join(destination, "release")), { code: "EACCES" });
		assert.deepEqual(await readdir(scratch), []);
		assert.deepEqual(await readdir(destination), []);
	}
	finally
	{
		if(previous === undefined) delete process.env.TMPDIR;
		else process.env.TMPDIR = previous;
		await chmod(destination, 0o755);
	}
});

test("unlocked in-project releases compile and preserve the source files", { skip: !enabled }, async t => {
	const { root } = await fixture(t), before = await lakeInputState(root);
	const outputRoot = join(root, "build/release");
	await build(root, outputRoot);
	assert.equal((await json(join(outputRoot, "bundle/locks/component-build-plan.json"))).bindingIr.origin, "lean-elaborated");
	assert.deepEqual((await lakeInputState(root)).filter(item => item.path !== "build" && !item.path.startsWith("build/")), before);
	assert.deepEqual(await readdir(join(root, "build")), ["release"]);
});

test("unlocked sources keep generator, configuration, and target capability gates", async t => {
	const { directory, root } = await fixture(t);
	for(const settings of [{ resources: ["OnboardingSmall.Object"] }, { arities: { "OnboardingSmall.add": 2 } }])
	{
		await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], ...settings }));
		await assert.rejects(() => prepareLakeEntryIntent({ projectRoot: root }), { code: "unsupported-export-configuration" });
	}
	await rm(join(root, "lean-bridge.exports.json"));
	const intent = await prepareLakeEntryIntent({ projectRoot: root });
	const inputRoot = join(directory, "inputs");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	await assert.rejects(() => createEngineExecutionRequest({ engineRoot, inputRoot, entryIntent: intent, targets: ["python"] }));
	const generated = await generatedLakeEntryFixture(t);
	await rm(join(generated.root, "lake-manifest.json"));
	const before = await lakeInputState(generated.workspace);
	await assert.rejects(() => prepareLakeEntryIntent({ projectRoot: generated.root }), /generators require a reviewed lake-manifest.json/);
	assert.deepEqual(await lakeInputState(generated.workspace), before);
});

test("reviewed IR retains its existing adapter gate instead of being promoted to fresh metadata", async t => {
	const { directory, root } = await fixture(t);
	const { ir } = await packageReference("tests/fixtures/documentation/lean-author");
	await saveLakeFile(root, "reviewed.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(root);
	await assert.rejects(() => prepareLakeEntryIntent({ projectRoot: root }), /not a supplied Binding IR/);
	await assert.rejects(() => build(root, join(directory, "result"), transport({ execute: () => assert.fail("Reviewed IR bypassed its adapter gate") })), { code: "compiler-adapter-ir-origin" });
	assert.deepEqual(await lakeInputState(root), before);
	assert.deepEqual(await readdir(directory), ["project"]);
});

for(const variant of ["tutorial", "custom", "scalars"]) test(`unlocked ${variant} builds reproduce, install offline, and preserve their sources`, { skip: !enabled }, async t => {
	const source = variant === "scalars" ? "tests/fixtures/onboarding/scalars" : "tests/fixtures/documentation/lean-author";
	const { directory, root } = await fixture(t, source);
	if(variant === "custom")
	{
		await mkdir(join(root, "lib"));
		await rename(join(root, "OnboardingSmall.lean"), join(root, "lib/OnboardingSmall.lean"));
		await saveLakeFile(root, "lakefile.toml", 'name = "onboarding-small"\nversion = "1.0.0"\n[[lean_lib]]\nname = "OnboardingSmall"\nsrcDir = "lib"\n');
		await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"] }));
		await saveLakeFile(root, ".lake/build/lib/lean/OnboardingSmall.olean", "stale interfaces must not be read\n");
		await saveLakeFile(root, "lib/OnboardingSmall.lean", 'namespace OnboardingSmall\nabbrev Word := UInt64\nlocal notation "WordArg" => Word\nprivate def identityWord (v : WordArg) := v\ndef add (a b : WordArg) := identityWord (a + b)\ndef isEmpty (v : String) := v.isEmpty\nend OnboardingSmall\n');
	}
	const moved = join(directory, "relocated");
	await cp(root, moved, { recursive: true });
	const before = await lakeInputState(root), movedBefore = await lakeInputState(moved), releases = [], requests = [];
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot);
		const bundleRoot = join(outputRoot, "bundle");
		requests.push(await json(join(outputRoot, "engine-execution-request.json")));
		const plan = await json(join(bundleRoot, "locks/component-build-plan.json"));
		const compilation = await json(join(bundleRoot, "locks/component-compilation-plan.json"));
		assert.equal(plan.bindingIr.origin, "lean-elaborated");
		assert.equal(compilation.schemaVersion, 4);
		await assertJsonSchema("component-build-plan", plan);
		await assertJsonSchema("component-compilation-plan", compilation);
		assert.deepEqual((await json(join(bundleRoot, "metadata/assurance.json"))).claims, []);
		const ir = await json(join(bundleRoot, "binding/binding-ir.json"));
		if(variant !== "custom")
		{
			delete ir.producers[0].extensions["lean-lang.org/elaboration-sha256"];
			assert.deepEqual(ir, (await packageReference(source)).ir, "Compiler-captured documentation API drifted");
		}
		else assert.equal(compilation.source.modules[0].path, "lib/OnboardingSmall.lean");
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(directory, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		releases.push(release);
	}
	assert.deepEqual(requests[0], requests[1]);
	assert.deepEqual(releases[0].report, releases[1].report);
	assert.equal(sha256(await readFile(releases[0].componentArchive)), sha256(await readFile(releases[1].componentArchive)));
	assert.deepEqual(await lakeInputState(root), before);
	assert.deepEqual(await lakeInputState(moved), movedBefore);
	const consumer = join(directory, "consumer");
	await mkdir(consumer);
	await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
	await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(directory, "npm-cache"), releases[0].runtimeArchive, releases[0].componentArchive], cwd: consumer });
	const call = variant === "scalars"
		? 'import * as api from "onboarding-scalars";\nconsole.log(api.u64(18446744073709551615n).toString());\n'
		: 'import {add,isEmpty} from "onboarding-small";\nconsole.log(JSON.stringify([String(add(100n,23n)),isEmpty(""),isEmpty("browser")]));\n';
	await saveLakeFile(consumer, "index.mjs", call);
	const installed = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: consumer });
	assert.equal(installed.stdout.trim(), variant === "scalars" ? "18446744073709551615" : '["123",true,false]');
});

test("an unlocked publication dry run rebuilds clean clones and verifies the handoff", { skip: !enabled }, async t => {
	const { directory, root } = await fixture(t);
	await lakeGit(root, "init", "--quiet");
	await lakeGit(root, "add", ".");
	await lakeGit(root, "commit", "--quiet", "-m", "Unlocked release candidate");
	const before = await lakeInputState(root);
	const result = await runComponentReproducibilityGate({ projectRoot: root
		, outputRoot: join(directory, "gate")
		, engineRoot, targets: ["npm"], environment
		, build: options => {
			assert.equal(options.lakeSnapshot.document.schemaVersion, 3);
			return buildCanonicalProject({ ...options, runner: transport() });
		}
	});
	assert.equal(result.result, "passed");
	assert.equal(result.externalRegistryWrites, false);
	await verifyPublishManifest({ manifestPath: result.publishManifest });
	await verifyComponentPackageReceipt({ receiptPath: result.receipt.path });
	assert.deepEqual(await lakeInputState(root), before);
});

test("unlocked builds reject new dependencies and unsupported APIs without a scanner fallback", { skip: !enabled || Boolean(externalEngine) }, async t => {
	for(const [label, source, expected] of [
		["implicit", "def OnboardingSmall.add {n : UInt64} := n", /implicit-parameter/]
		, ["generic", "universe u\ndef OnboardingSmall.add {α : Type u} (v : α) := v", /specialization-required/]
		, ["effect", "def OnboardingSmall.add (v : UInt64) : IO UInt64 := pure v", /unsupported-effect/]
		, ["admitted", "def OnboardingSmall.add (v : UInt64) : UInt64 := by sorry", /admitted-implementation/]
		, ["compiler-error", "def OnboardingSmall.add : UInt64 := unknownDefinition", /unknownDefinition/]
		, ["dependency", "import Missing\ndef OnboardingSmall.add : UInt64 := 0", /review lake-manifest.json/]
	]) await t.test(label, async t => {
		const { directory, root } = await fixture(t);
		await saveLakeFile(root, "OnboardingSmall.lean", `${source}\n`);
		if(label === "dependency") await saveLakeFile(root, "lakefile.toml", 'name = "onboarding-small"\nversion = "1.0.0"\n[[require]]\nname = "Missing"\npath = "../missing"\n[[lean_lib]]\nname = "OnboardingSmall"\n');
		const before = await lakeInputState(root);
		await assert.rejects(() => build(root, join(directory, "rejected"), transport({ compiler: { capture: () => assert.fail("Unsupported API reached target compilation") } })), error => {
			assert.match(`${error.message}\n${JSON.stringify(error.details)}`, expected);
			return true;
		});
		assert.deepEqual(await lakeInputState(root), before);
		assert.deepEqual(await readdir(directory), ["project"]);
	});
});

test("unlocked builds reject target metadata drift before linking", { skip: !enabled || Boolean(externalEngine) }, async t => {
	const { directory, root } = await fixture(t);
	let altered = false;
	const compiler = { capture: async request => {
		assert.equal(request.command.endsWith("emcc"), false, "Altered metadata reached linking");
		const result = await processBuildRunner.capture(request);
		if(request.args[0] === "--run" && request.args[1].endsWith("NativeExports.lean"))
		{
			const metadata = JSON.parse(result.stdout);
			metadata.modules.flatMap(module => module.declarations).find(item => item.selected).projection.result.name = "bool";
			altered = true;
			return { ...result, stdout: canonicalJson(metadata) };
		}
		return result;
	} };
	await assert.rejects(() => build(root, join(directory, "metadata-drift"), transport({ compiler })), { code: "lean-entry-elaboration-drift" });
	assert.equal(altered, true);
	assert.deepEqual(await readdir(directory), ["project"]);
});

test("unlocked builds reject source drift after linking", { skip: !enabled || Boolean(externalEngine) }, async t => {
	const { directory, root } = await fixture(t);
	await assert.rejects(() => build(root, join(directory, "source-drift"), transport({ after: () => saveLakeFile(root, "lake-manifest.json", '{"version":"1.2.0","packages":[]}') })), { code: "lake-source-drift" });
	assert.deepEqual(await readdir(directory), ["project"]);
});

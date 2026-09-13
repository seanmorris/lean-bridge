/**
 * Installed npm/CPAN consumers use generated values from relocated Lake builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { analyzeLeanProject, inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";
import { linkComponentSideModule } from "../src/build/component-side-linker.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { compileCpanXsVariant } from "../src/build/perl-xs.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { runComponentReproducibilityGate } from "../src/release/component-reproducibility-gate.mjs";
import { verifyPublishManifest } from "../src/release/publish-manifest.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../src/release/cpan-package.mjs";
import { installCpanArchive } from "../scripts/test-perl-package-consumer.mjs";
import { generatedLakeWorkspaceFixture as fixture, generatedLakeEntryFixture } from "./helpers/lake-generator.mjs";
import { lakeGit, lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertArchiveBytesEqual } from "./helpers/archive-bytes.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { selectLakeEntryModules } from "../src/build/lake-entry-modules.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST === "1";
const engineRoot = process.cwd();
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(engineRoot, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
const floor = process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
const runtimeRoot = process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy";
const externalEngine = process.env.LEAN_BRIDGE_LAKE_ENGINE;
const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 120000 });
const runEngine = async (input, outputRoot) => {
	if(!externalEngine) return executeComponentEngineRequest({ ...input, engineRoot, outputRoot });
	await processBuildRunner.capture({ command: resolve(externalEngine)
		, args: ["--request", input.requestPath, "--component", input.inputRoot, "--output", outputRoot, "--backend", "offline-acceptance"]
		, timeoutMs: 1200000 });
	return { report: JSON.parse(await readFile(join(outputRoot, "engine-execution-report.json"), "utf8")) };
};
const prepare = async (projectRoot, directory) => {
	const inventory = await inspectLeanProject(projectRoot);
	if(selectLakeEntryModules(inventory.configurationRecord.configuration, inventory.inputs).some(entry => entry.origin.kind === "generated"))
	{
		const entryIntent = await prepareLakeEntryIntent({ projectRoot });
		await assertJsonSchema("lake-entry-intent", entryIntent.document);
		const inputRoot = join(directory, "inputs"), requestPath = join(directory, "request.json");
		await writeLakeEntryInputs({ intent: entryIntent, outputRoot: inputRoot });
		const request = await writeEngineExecutionRequest({ output: requestPath, engineRoot, inputRoot, entryIntent, targets: ["npm"], cachePolicy: "off" });
		await assertJsonSchema("engine-execution-request", request.document);
		return { inputRoot, requestPath, request, entryIntent };
	}
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot, targets: ["npm"] });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	const inputRoot = join(directory, "inputs"), requestPath = join(directory, "request.json");
	await writeComponentCompilationInputs({ projectRoot, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
	const request = await writeEngineExecutionRequest({ output: requestPath, engineRoot, inputRoot, componentPlan, compilationPlan, targets: ["npm"], cachePolicy: "off" });
	return { inputRoot, requestPath, request, componentPlan, compilationPlan };
};

const nativeAcceptance = (profile, fixture) => test(`generated native ${profile} packages relocate identically and run through installed CPAN APIs`, { skip: !enabled, timeout: 1200000 }, async t => {
	const first = await fixture(t), nativeRuntime = join(first.directory, "runtime");
	await buildNativeSharedRuntime({ outputRoot: nativeRuntime, leanPrefix });
	const runtimePackage = join(first.directory, "runtime-package");
	await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot: nativeRuntime, leanPrefix, glibcMinimumVersion: floor });
	await compileCpanXsVariant({ packageRoot: runtimePackage, perl });
	const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: join(first.directory, "runtime-archive") });
	const buildRuntime = await installCpanArchive({ archive: runtimeArchive.path
		, workingRoot: first.directory
		, prefix: join(first.directory, "build-runtime")
		, perl, mode: "prebuilt-only" });
	for(const context of [first, await fixture(t, "telemetry")])
		await t.test(context.names.root, async () => {
			const relocated = join(context.directory, "relocated");
			await cp(context.workspace, relocated, { recursive: true });
			const before = await lakeInputState(context.workspace), otherBefore = await lakeInputState(relocated), builds = [];
			for(const [label, projectRoot] of [["left", context.root], ["right", join(relocated, "project")]])
			{
				const componentRoot = join(context.directory, label), packageRoot = join(context.directory, `${label}-package`);
				const built = await buildNativeComponent({ projectRoot, outputRoot: componentRoot, runtimeRoot: nativeRuntime, leanPrefix });
				const handoff = JSON.parse(await readFile(join(componentRoot, "lake-generated-sources.json"), "utf8"));
				await assertJsonSchema("lake-generated-sources", handoff);
				await assertJsonSchema("lake-native-compilation", built.receipt.nativeCompilation);
				assert.equal(built.receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256, sha256(canonicalJson(handoff)));
				assert.equal(built.receipt.nativeCompilation.overlaySha256, handoff.overlaySha256);
				assert.ok(handoff.resolution.result.resolution.modules.some(module => module.source.origin.kind === "generated"));
				if(profile === "public entry")
				{
					assert.equal(handoff.resolution.result.resolution.modules.find(module => module.module === context.names.root).source.origin.kind, "generated");
					assert.equal(built.receipt.sourceIdentity.request.exportModules[0], context.names.root);
				}
				assert.ok(built.receipt.nativeCompilation.objects[0].inputs.some(file => file.path.endsWith("/root/native/generated.h")));
				assert.equal(canonicalJson(built.receipt).includes(context.directory), false);
				await stageCpanPackage({ outputRoot: packageRoot, runtimeRoot: nativeRuntime, componentRoot, leanPrefix, version: "1.000", glibcMinimumVersion: floor });
				assert.equal(sha256(await readFile(join(packageRoot, "lake-generated-sources.json"))), sha256(canonicalJson(handoff)));
				await compileCpanXsVariant({ packageRoot, perl, environment: { ...process.env, PERL5LIB: buildRuntime.perl5lib } });
				const archive = await archiveCpanPackage({ packageRoot, outputRoot: join(context.directory, `${label}-archives`) });
				builds.push({ built, archive });
			}
			assert.deepEqual(builds[0].built.receipt, builds[1].built.receipt);
			assertArchiveBytesEqual(await readFile(builds[0].archive.path), await readFile(builds[1].archive.path));
			assert.deepEqual(await lakeInputState(context.workspace), before);
			assert.deepEqual(await lakeInputState(relocated), otherBefore);
			await rename(context.workspace, join(context.directory, "detached"));
			await rename(relocated, join(context.directory, "detached-other"));
			const prefix = join(context.directory, "installed");
			for(const archive of [runtimeArchive.path, builds[0].archive.path])
				await installCpanArchive({ archive, workingRoot: context.directory, prefix, perl, mode: "prebuilt-only" });
			const result = await run(perl, [`-MLeanBridge::${context.names.root}`, "-e", `print LeanBridge::${context.names.root}::${context.names.operation}(10)`], context.directory, { ...process.env, PERL5LIB: join(prefix, "lib/perl5") });
			assert.equal(result.stdout, context.names.root === "Shop" ? "45" : "67");
			t.diagnostic(canonicalJson({ package: context.names.root, archiveSha256: sha256(await readFile(builds[0].archive.path)), value: result.stdout }));
		});
});
nativeAcceptance("Lean/C", fixture);
nativeAcceptance("public entry", generatedLakeEntryFixture);

for(const [profile, makeFixture] of [["imports", fixture], ["entry", generatedLakeEntryFixture]])
for(const variant of ["shop", "telemetry"]) test(`generated ${profile} ${variant} compiles from detached captures into identical installed npm releases`, { skip: !enabled, timeout: 1200000 }, async t => {
	const context = await makeFixture(t, variant), relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const inputs = [];
	for(const [index, projectRoot] of [context.root, join(relocated, "project")].entries()) inputs.push(await prepare(projectRoot, join(context.directory, `build-${index}`)));
	assert.deepEqual(inputs[0].request.document, inputs[1].request.document);
	assert.ok(inputs[0].request.document.output.authorizedFiles.includes("generated/lake-generated-sources.json"));
	const before = await lakeInputState(context.workspace), otherBefore = await lakeInputState(relocated);
	await rename(context.workspace, join(context.directory, "detached"));
	await rename(relocated, join(context.directory, "detached-other"));
	const releases = [];
	for(const [index, input] of inputs.entries())
	{
		const outputRoot = join(context.directory, `engine-${index}`), inputBefore = await lakeInputState(input.inputRoot);
		const built = await runEngine(input, outputRoot);
		assert.deepEqual(await lakeInputState(input.inputRoot), inputBefore);
		const bundleRoot = join(outputRoot, "bundle");
		const manifest = JSON.parse(await readFile(join(bundleRoot, "locks/lean-target-c-manifest.json"), "utf8"));
		const handoff = JSON.parse(await readFile(join(bundleRoot, "generated/lake-generated-sources.json"), "utf8"));
		const link = JSON.parse(await readFile(join(bundleRoot, "locks/side-module-link-manifest.json"), "utf8"));
		await assertJsonSchema("lean-target-c-manifest", manifest);
		await assertJsonSchema("side-module-link-manifest", link);
		await assertJsonSchema("lake-generated-sources", handoff);
		assert.equal(manifest.schemaVersion, 3);
		assert.equal(manifest.lakeDependencies.generatedSourcesSha256, sha256(canonicalJson(handoff)));
		assert.equal(link.generatedSourcesSha256, manifest.lakeDependencies.generatedSourcesSha256);
		assert.equal(link.nativeCompilation.overlaySha256, handoff.overlaySha256);
		assert.deepEqual(manifest.modules.slice(0, -1).map(module => module.module), ["Extra", ...(profile === "entry" ? [] : ["Generated"]), context.names.remote, context.names.local, context.names.root]);
		assert.equal(canonicalJson(handoff).includes(context.directory), false);
		assert.deepEqual(handoff.outputs.map(file => file.path), [`root/generated/${profile === "entry" ? context.names.root : "Generated"}.lean`, "root/native/generated.c", "root/native/generated.h"]);
		if(profile === "entry")
		{
			const component = JSON.parse(await readFile(join(bundleRoot, "locks/component-build-plan.json"), "utf8"));
			const compilation = JSON.parse(await readFile(join(bundleRoot, "locks/component-compilation-plan.json"), "utf8"));
			const evidence = await readFile(join(bundleRoot, "metadata/lake-entry-exports.json"));
			await assertJsonSchema("lake-entry-elaboration", JSON.parse(evidence));
			assert.equal(component.bindingIr.origin, "lean-elaborated");
			assert.equal(compilation.schemaVersion, 4);
			assert.equal(compilation.source.elaborationSha256, sha256(evidence));
			await assertJsonSchema("component-build-plan", component);
			await assertJsonSchema("component-compilation-plan", compilation);
		}
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(context.directory, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		releases.push({ ...release, report: built.report, manifest, handoff, link });
	}
	assert.deepEqual(releases[0].manifest, releases[1].manifest);
	assert.deepEqual(releases[0].handoff, releases[1].handoff);
	assert.deepEqual(releases[0].link, releases[1].link);
	assert.deepEqual(releases[0].report, releases[1].report);
	assertArchiveBytesEqual(await readFile(releases[0].componentArchive), await readFile(releases[1].componentArchive));
	const consumer = join(context.directory, "consumer");
	await mkdir(consumer);
	await saveLakeFile(consumer, "package.json", JSON.stringify({ private: true, type: "module" }));
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(context.directory, "npm-cache"), releases[0].runtimeArchive, releases[0].componentArchive], consumer);
	await saveLakeFile(consumer, "index.mjs", `import { ${context.names.operation} as call } from ${JSON.stringify(variant)};\nconsole.log(JSON.stringify([call(0), call(10), call(4294967295)]));\n`);
	assert.deepEqual(JSON.parse((await run(process.execPath, ["index.mjs"], consumer)).stdout), variant === "shop" ? [25, 45, 23] : [37, 67, 34]);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached")), before);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached-other")), otherBefore);
	t.diagnostic(canonicalJson({ variant, handoffSha256: sha256(canonicalJson(releases[0].handoff)), archiveSha256: sha256(await readFile(releases[0].componentArchive)) }));
	if(profile === "entry" && variant === "shop")
		await t.test("canonical build rejects a local dependency changed after engine execution", async () => {
			const projectRoot = join(context.directory, "detached/project"), outputRoot = join(context.directory, "changed-author-input");
			const runner = { capture: async request => {
				assert.equal(request.command, "nix");
				if(request.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11\n", stderr: "", code: 0 };
				assert.ok(request.args.includes("run"));
				const value = flag => request.args[request.args.indexOf(flag) + 1];
				const requested = JSON.parse(await readFile(value("--request"), "utf8"));
				assert.deepEqual(requested, inputs[0].request.document);
				// Replay the exact output already compiled above to isolate the host's post-build check.
				await cp(join(context.directory, "engine-0"), value("--output"), { recursive: true });
				await saveLakeFile(join(context.directory, "detached/local"), `${context.names.local}.lean`, "-- changed during build\n");
				return { stdout: "", stderr: "", code: 0 };
			} };
			await assert.rejects(() => buildCanonicalProject({ projectRoot
				, outputRoot, engineRoot, targets: ["npm"], runner
				, cache: { policy: "off" }
				, environment: { LEAN_BRIDGE_BUILD_BACKEND: "nix" } }), { code: "lake-source-drift" });
			await assert.rejects(() => readFile(join(outputRoot, "engine-execution-report.json")), { code: "ENOENT" });
		});
});

test("generated WASM handoffs reject altered bytes, receipts and origins before invoking emcc", { skip: !enabled || Boolean(externalEngine), timeout: 600000 }, async t => {
	const context = await fixture(t), input = await prepare(context.root, join(context.directory, "build"));
	const targetCRoot = join(context.directory, "target-c");
	const compiled = await compileLeanComponentSources({ ...input, engineRoot, outputRoot: targetCRoot });
	const artifactPath = join(targetCRoot, "lake-generated-sources.json"), original = await readFile(artifactPath);
	await chmod(artifactPath, 0o644);
	const runner = { capture: () => assert.fail("Invalid generated sources reached emcc") };
	for(const change of [
		value => { value.outputs[0].text += "\n"; }
		, value => { value.outputs[0].path = "../escape.lean"; }
		, value => { value.outputs.push(value.outputs[0]); }
		, value => { value.prerequisites.generators[0].receipt.outputs[0].sha256 = "0".repeat(64); }
		, value => { value.resolution.result.resolution.modules[1].source.origin.kind = "captured"; }
		, value => { value.overlay.outputs[0].generator = "root/unused"; }
		, value => { value.requestedModules = ["Extra"]; }
	]) {
		const invalid = JSON.parse(original); change(invalid);
		await saveLakeFile(targetCRoot, "lake-generated-sources.json", canonicalJson(invalid));
		for(const resign of [false, true])
		{
			const manifest = structuredClone(compiled.manifest);
			if(resign) manifest.lakeDependencies.generatedSourcesSha256 = sha256(canonicalJson(invalid));
			await saveLakeFile(targetCRoot, "lean-target-c-manifest.json", canonicalJson(manifest));
			await assert.rejects(() => linkComponentSideModule({ ...input, engineRoot, targetCRoot, outputRoot: join(context.directory, "invalid-link"), runner }));
		}
	}
	await saveLakeFile(targetCRoot, "lake-generated-sources.json", original);
	await saveLakeFile(targetCRoot, "lean-target-c-manifest.json", canonicalJson(compiled.manifest));
	await chmod(join(targetCRoot, "native/root/Extra.lean"), 0o644);
	await writeFile(join(targetCRoot, "native/root/Extra.lean"), "changed");
	await assert.rejects(() => linkComponentSideModule({ ...input, engineRoot, targetCRoot, outputRoot: join(context.directory, "invalid-source"), runner }), { code: "lake-snapshot-drift" });
});

for(const [profile, makeFixture] of [["imports", fixture], ["entry", generatedLakeEntryFixture]])
for(const drift of [false, true]) test(`generated ${profile} npm publication dry run ${drift ? "rejects changed generator input" : "reproduces committed source and verifies its release"}`, { skip: !enabled, timeout: 1200000 }, async t => {
	const context = await makeFixture(t);
	await saveLakeFile(context.root, ".gitignore", ".lake/\n");
	await saveLakeFile(context.root, "package.json", JSON.stringify({ name: "shop", version: "1.0.0", license: "MIT" }));
	await saveLakeFile(context.root, "LICENSE", await readFile("LICENSE"));
	await lakeGit(context.root, "init", "--quiet");
	await lakeGit(context.root, "add", ".");
	await lakeGit(context.root, "commit", "--quiet", "-m", "Generated release candidate");
	let builds = 0;
	// Locally only Nix's command transport is replaced. CI uses the pinned engine.
	const runner = { capture: async request => {
		if(request.command !== "nix") return processBuildRunner.capture(request);
		if(request.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11\n", stderr: "", code: 0 };
		assert.ok(request.args.includes("run"));
		const value = flag => request.args[request.args.indexOf(flag) + 1];
		await runEngine({ requestPath: value("--request"), inputRoot: value("--component") }, value("--output"));
		builds += 1;
		if(drift && builds === 1) await saveLakeFile(context.root, "data/value.txt", "41\n");
		return { stdout: "", stderr: "", code: 0 };
	} };
	const outputRoot = join(context.directory, "release-gate"), before = await lakeInputState(context.workspace);
	const check = () => runComponentReproducibilityGate({ projectRoot: context.root
		, outputRoot, engineRoot, targets: ["npm"]
		, environment: { LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: resolve(runtimeRoot) }
		, build: options => buildCanonicalProject({ ...options, runner }) });
	if(drift)
	{
		await assert.rejects(check, error => /changed|drift|differ/i.test(`${error.message} ${error.code}`));
		assert.equal(JSON.parse(await readFile(join(outputRoot, "evidence/reproducibility.json"), "utf8")).result, "failed");
	}
	else
	{
		const result = await check();
		assert.equal(result.result, "passed");
		assert.equal(result.externalRegistryWrites, false);
		await verifyPublishManifest({ manifestPath: result.publishManifest });
		await verifyComponentPackageReceipt({ receiptPath: result.receipt.path });
		assert.deepEqual(await lakeInputState(context.workspace), before);
	}
	assert.equal(builds, 2);
});

test("generated Lean without linked C still rejects foreign implementations", { skip: !enabled || Boolean(externalEngine), timeout: 600000 }, async t => {
	const context = await fixture(t);
	await saveLakeFile(context.root, "lakefile.lean", context.lakefile.replace('  moreLinkObjs := #[{ key := .packageTarget .anonymous `generatedC }]\n', ""));
	const text = '@[extern "generated_value"] opaque Generated.read (unused : Unit) : UInt32\ndef Generated.value : UInt32 := Generated.read ()\n';
	await saveLakeFile(context.root, "tools/TableGenerator.lean", `def TableGenerator.generate (_inputs : Array (String × String)) (_args : Array String)
    : Except String (Array (String × String)) :=
  .ok #[("lean", ${JSON.stringify(text)}), ("header", ""), ("native", "")]
`);
	const input = await prepare(context.root, join(context.directory, "build")), before = await lakeInputState(context.workspace);
	const outputRoot = join(context.directory, "foreign-target-c");
	await assert.rejects(() => compileLeanComponentSources({ ...input, engineRoot, outputRoot }), error => {
		assert.equal(error.code, "unreviewed-native-implementation");
		assert.match(JSON.stringify(error.details), /reviewed unsafe, partial or foreign implementation contract/);
		return true;
	});
	assert.deepEqual(await lakeInputState(context.workspace), before);
	await assert.rejects(() => readFile(join(outputRoot, "lean-target-c-manifest.json")), { code: "ENOENT" });
});

test("generated entry metadata must match the fresh target compilation before linking", { skip: !enabled || Boolean(externalEngine), timeout: 600000 }, async t => {
	const context = await generatedLakeEntryFixture(t), input = await prepare(context.root, join(context.directory, "build"));
	const before = await lakeInputState(input.inputRoot), outputRoot = join(context.directory, "changed-metadata");
	let altered = false;
	const runner = { capture: async request => {
		assert.equal(request.command.endsWith("emcc"), false, "Altered metadata reached the linker");
		const result = await processBuildRunner.capture(request);
		if(request.args[0] === "--run" && request.args[1].endsWith("NativeExports.lean"))
		{
			const metadata = JSON.parse(result.stdout);
			metadata.declarations[0].result.name = "bool";
			altered = true;
			return { ...result, stdout: canonicalJson(metadata) };
		}
		return result;
	} };
	await assert.rejects(() => executeComponentEngineRequest({ ...input, engineRoot, outputRoot, runner }), { code: "lean-entry-elaboration-drift" });
	assert.equal(altered, true);
	assert.deepEqual(await lakeInputState(input.inputRoot), before);
	assert.equal((await readdir(context.directory)).some(name => name === "changed-metadata" || name.startsWith(".lean-bridge-entry-engine-")), false);
});

test("generated entry modules cannot introduce admitted implementations", { skip: !enabled || Boolean(externalEngine), timeout: 600000 }, async t => {
	const context = await generatedLakeEntryFixture(t);
	const text = "def Shop.quote (_value : UInt32) : UInt32 := by sorry\n";
	await saveLakeFile(context.root, "tools/TableGenerator.lean", `def TableGenerator.generate (_inputs : Array (String × String)) (_args : Array String)
    : Except String (Array (String × String)) :=
  .ok #[("lean", ${JSON.stringify(text)}), ("header", ""), ("native", "")]
`);
	const input = await prepare(context.root, join(context.directory, "build")), before = await lakeInputState(context.workspace);
	const outputRoot = join(context.directory, "admitted-output");
	const runner = { capture: () => assert.fail("Admitted generated API reached target compilation") };
	await assert.rejects(() => executeComponentEngineRequest({ ...input, engineRoot, outputRoot, runner }), error => /depends on sorry/.test(JSON.stringify(error.details)));
	assert.deepEqual(await lakeInputState(context.workspace), before);
	assert.equal((await readdir(context.directory)).some(name => name === "admitted-output" || name.startsWith(".lean-bridge-entry-engine-")), false);
});

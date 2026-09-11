/**
 * Compile locked Lake imports offline, then install the resulting npm archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "../src/build/component-compilation-plan.mjs";
import { writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { compileLeanComponentSources } from "../src/build/lean-component-compiler.mjs";
import { linkComponentSideModule } from "../src/build/component-side-linker.mjs";
import { buildCanonicalProject, processBuildRunner } from "../src/build/canonical-build.mjs";
import { runComponentReproducibilityGate } from "../src/release/component-reproducibility-gate.mjs";
import { verifyPublishManifest } from "../src/release/publish-manifest.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { customLakeRoot, lakeGit, lakeInputState, lakeWorkspaceFixture, nativeLakeInput, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_WASM_TEST === "1";
const execute = promisify(execFile);
const engineRoot = process.cwd();
const externalEngine = process.env.LEAN_BRIDGE_LAKE_ENGINE;
const runtimeRoot = process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy";
const runEngine = async (input, outputRoot) => {
	if(!externalEngine) return executeComponentEngineRequest({ ...input, engineRoot, outputRoot, backend: "offline-acceptance" });
	await execute(resolve(externalEngine), ["--request", input.requestPath, "--component", input.inputRoot, "--output", outputRoot, "--backend", "offline-acceptance"],
		{ timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
	return { request: input.request, report: JSON.parse(await readFile(join(outputRoot, "engine-execution-report.json"), "utf8")) };
};
const prepare = async (projectRoot, directory) => {
	const analysis = await analyzeLeanProject(projectRoot);
	const componentPlan = await prepareComponentBuildPlan({ projectRoot, engineRoot, targets: ["npm"] });
	const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
	const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
	const inputRoot = join(directory, "inputs"), requestPath = join(directory, "request.json");
	await writeComponentCompilationInputs({ projectRoot, outputRoot: inputRoot, analysis, componentPlan, compilerAdapters });
	const request = await writeEngineExecutionRequest({ output: requestPath, engineRoot, inputRoot, componentPlan, compilationPlan, targets: ["npm"], cachePolicy: "off" });
	return { inputRoot, requestPath, request, componentPlan, compilationPlan };
};

for(const layout of ["default", "custom", "native-input"]) for(const variant of ["shop", "telemetry"]) test(`locked ${variant} dependencies with ${layout} root layout compile offline into identical relocated npm releases`, { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t, variant);
	const rootPath = layout === "custom" ? await customLakeRoot(context) : `${context.names.root}.lean`;
	if(layout === "native-input") await nativeLakeInput(context);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const roots = [context.root, join(relocated, "project")];
	const prepared = [];
	for(const [index, root] of roots.entries()) prepared.push(await prepare(root, join(context.directory, `build-${index}`)));
	assert.deepEqual(prepared[0].request.document, prepared[1].request.document);
	const authorBefore = await lakeInputState(context.workspace);
	const movedBefore = await lakeInputState(relocated);
	// Make both original roots and every locked path unavailable to the engine.
	const detached = join(context.directory, "detached-author");
	const moved = join(context.directory, "detached-relocated");
	await rename(context.workspace, detached);
	await rename(relocated, moved);
	const outputs = [];
	for(const [index, input] of prepared.entries())
	{
		const outputRoot = join(context.directory, `execution-${index}`);
		const before = await lakeInputState(input.inputRoot);
		const result = await runEngine(input, outputRoot);
		assert.deepEqual(await lakeInputState(input.inputRoot), before);
		const bundleRoot = join(outputRoot, "bundle");
		const manifest = JSON.parse(await readFile(join(bundleRoot, "locks/lean-target-c-manifest.json"), "utf8"));
		await assertJsonSchema("lean-target-c-manifest", manifest);
		let nativeEvidence = null;
		if(layout === "native-input")
		{
			const link = JSON.parse(await readFile(join(bundleRoot, "locks/side-module-link-manifest.json"), "utf8"));
			await assertJsonSchema("side-module-link-manifest", link);
			assert.equal(link.nativeCompilation.objects.length, 1);
			assert.ok(link.nativeCompilation.objects[0].inputs.some(input => input.path === `snapshot/packages/${context.names.remote}/native code/factor.h`));
			assert.equal(JSON.stringify(link.nativeCompilation).includes(context.directory), false);
			nativeEvidence = link.nativeCompilation;
		}
		assert.deepEqual(manifest.modules.map(module => module.module), [context.names.remote, context.names.local, context.names.root, input.compilationPlan.document.compilerAdapters.module]);
		assert.equal(manifest.lakeDependencies.resolution.snapshotSha256, input.componentPlan.document.source.lakeSnapshotSha256);
		assert.equal(manifest.lakeDependencies.resolution.modules.at(-1).path, `root/${rootPath}`);
		assert.ok(result.request.document.output.authorizedFiles.includes(`lake/packages/${context.names.remote}/lib/${context.names.remote}.lean`));
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(context.directory, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		outputs.push({ manifest, release, report: result.report, nativeEvidence });
	}
	assert.deepEqual(outputs[0].manifest, outputs[1].manifest);
	assert.deepEqual(outputs[0].nativeEvidence, outputs[1].nativeEvidence);
	assert.deepEqual(outputs[0].report, outputs[1].report);
	assert.deepEqual(outputs[0].release.report, outputs[1].release.report);
	assert.deepEqual(await readFile(outputs[0].release.componentArchive), await readFile(outputs[1].release.componentArchive));
	assert.deepEqual(await lakeInputState(detached), authorBefore);
	assert.deepEqual(await lakeInputState(moved), movedBefore);
	const consumer = join(context.directory, "consumer");
	await mkdir(consumer);
	await writeFile(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
	const release = outputs[0].release;
	await execute("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", release.runtimeArchive, release.componentArchive], { cwd: consumer });
	await writeFile(join(consumer, "index.mjs"), `import {${context.names.operation} as call} from ${JSON.stringify(variant)};\nconsole.log(JSON.stringify([call(0),call(42),call(4294967295)]));\n`);
	const installed = await execute(process.execPath, ["index.mjs"], { cwd: consumer });
	assert.deepEqual(JSON.parse(installed.stdout), variant === "shop" ? [6, 90, 4] : [6, 132, 3]);
	await saveLakeFile(prepared[0].inputRoot, `lake/packages/${context.names.local}/${context.names.local}.lean`, "changed");
	await assert.rejects(() => runEngine(prepared[0], join(context.directory, "tampered-engine")), /input closure differs/);
	t.diagnostic(JSON.stringify({ variant, layout
		, snapshotSha256: prepared[0].componentPlan.document.source.lakeSnapshotSha256
		, targetCManifestSha256: sha256(canonicalJson(outputs[0].manifest))
		, componentArchiveSha256: sha256(await readFile(release.componentArchive)) }));
});

test("locked WASM linking rejects tampered source, resolution, order and fresh interfaces before invoking emcc", { skip: !enabled || Boolean(externalEngine) }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await nativeLakeInput(context);
	const input = await prepare(context.root, join(context.directory, "build"));
	const targetCRoot = join(context.directory, "target-c");
	const compiled = await compileLeanComponentSources({ ...input, engineRoot, outputRoot: targetCRoot });
	const manifestPath = join(targetCRoot, "lean-target-c-manifest.json");
	const runner = { capture: async () => { assert.fail("Invalid target C reached the linker"); } };
	for(const change of [
		value => { value.lakeDependencies.snapshot.packages[0].source.dir = "../escape"; }
		, value => { value.lakeDependencies.resolution.modules[0].source.sha256 = "0".repeat(64); }
		, value => { value.modules.reverse(); }
		, value => { value.modules[0].sourceSha256 = "0".repeat(64); }
		, value => { value.modules[0].olean = "../../escape"; }
		, value => { value.modules[0].oleanSha256 = "0".repeat(64); }
		, value => { value.lakeDependencies.resolutionSha256 = "0".repeat(64); }
	]) {
		const manifest = JSON.parse(canonicalJson(compiled.manifest));
		change(manifest);
		await writeFile(manifestPath, canonicalJson(manifest));
		await assert.rejects(() => linkComponentSideModule({ ...input, targetCRoot, engineRoot, outputRoot: join(context.directory, "rejected-link"), runner }),
			error => ["invalid-lake-resolution", "target-c-manifest-drift", "invalid-target-c-manifest", "target-c-drift"].includes(error.code));
	}
	await writeFile(manifestPath, canonicalJson(compiled.manifest));
	const header = `native/packages/${context.names.remote}/native code/factor.h`;
	const headerBytes = await readFile(join(targetCRoot, header));
	await saveLakeFile(targetCRoot, header, "changed captured header");
	await assert.rejects(() => linkComponentSideModule({ ...input, targetCRoot, engineRoot, outputRoot: join(context.directory, "header-drift"), runner }), { code: "lake-snapshot-drift" });
	await saveLakeFile(targetCRoot, header, headerBytes);
	await saveLakeFile(targetCRoot, compiled.manifest.modules[0].olean, "stale interface");
	await assert.rejects(() => linkComponentSideModule({ ...input, targetCRoot, engineRoot, outputRoot: join(context.directory, "stale-link"), runner }), { code: "target-c-drift" });
	await saveLakeFile(input.inputRoot, "lake/packages/Catalog/Catalog.lean", "changed");
	await assert.rejects(() => compileLeanComponentSources({ ...input, engineRoot, outputRoot: join(context.directory, "stale-compile") }), { code: "lake-snapshot-drift" });
});

test("WASM C inputs cannot bypass the fresh foreign-implementation gate", { skip: !enabled || Boolean(externalEngine) }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await nativeLakeInput(context, true);
	const input = await prepare(context.root, join(context.directory, "build"));
	const outputRoot = join(context.directory, "rejected-foreign");
	await assert.rejects(() => compileLeanComponentSources({ ...input, engineRoot, outputRoot }), error => {
		assert.equal(error.code, "unreviewed-native-implementation");
		assert.match(JSON.stringify(error.details), /reviewed unsafe, partial or foreign implementation contract/);
		return true;
	});
	await assert.rejects(() => readFile(join(outputRoot, "lean-target-c-manifest.json")), { code: "ENOENT" });
});

test("the compiler and linker reject a planned root path that differs from Lake ownership", { skip: !enabled || Boolean(externalEngine) }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "decoy/Shop.lean", "-- A captured file that Lake does not own as Shop.\n");
	// Export-only selection keeps the unused decoy in the captured inventory.
	// Altering the plan to select that file must fail in both compiler and linker.
	await saveLakeFile(context.root, "lean-bridge.exports.json", JSON.stringify({ schemaVersion: 1, exports: ["Shop.quote"] }));
	const input = await prepare(context.root, join(context.directory, "build"));
	const document = structuredClone(input.compilationPlan.document);
	document.source.modules = [{ ...input.componentPlan.document.source.inputs.find(file => file.path === "decoy/Shop.lean"), module: "Shop" }];
	document.source.requestedModules = ["Shop"];
	const compilationPlan = { document, sha256: sha256(canonicalJson(document)) };
	await assert.rejects(() => compileLeanComponentSources({ ...input, compilationPlan, engineRoot, outputRoot: join(context.directory, "wrong-source") }), { code: "lean-component-input-drift" });
	const targetCRoot = join(context.directory, "target-c");
	const compiled = await compileLeanComponentSources({ ...input, engineRoot, outputRoot: targetCRoot });
	await saveLakeFile(targetCRoot, "lean-target-c-manifest.json", canonicalJson({ ...compiled.manifest, compilationPlanSha256: compilationPlan.sha256 }));
	await assert.rejects(() => linkComponentSideModule({ ...input
		, compilationPlan
		, targetCRoot
		, engineRoot
		, outputRoot: join(context.directory, "wrong-link")
		, runner: { capture: async () => assert.fail("Wrong root source reached emcc") } }), { code: "target-c-manifest-drift" });
});

for(const drift of [false, true]) test(`locked release dry run ${drift ? "rejects dependency drift" : "reproduces both clean clones and verifies publication evidence"}`, { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await customLakeRoot(context);
	await nativeLakeInput(context);
	await saveLakeFile(context.local, "NOTICE", "Catalog dependency notice\n");
	await saveLakeFile(context.root, ".gitignore", ".lake/\n");
	await saveLakeFile(context.root, "package.json", JSON.stringify({ license: "MIT" }));
	await saveLakeFile(context.root, "LICENSE", await readFile("LICENSE"));
	await lakeGit(context.root, "init", "--quiet");
	await lakeGit(context.root, "add", ".");
	await lakeGit(context.root, "commit", "--quiet", "-m", "Dependency release candidate");
	let builds = 0;
	// Substitute only the Nix command transport locally. Compilation, linking,
	// canonical build validation, packaging and publication checks remain real.
	const runner = { capture: async request => {
		if(request.command !== "nix") return processBuildRunner.capture(request);
		if(request.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11\n", stderr: "", code: 0 };
		assert.ok(request.args.includes("run"));
		const value = flag => request.args[request.args.indexOf(flag) + 1];
		const requestPath = value("--request"), inputRoot = value("--component");
		const document = JSON.parse(await readFile(requestPath, "utf8"));
		await runEngine({ requestPath, inputRoot, request: { document } }, value("--output"));
		builds += 1;
		if(drift && builds === 1) await saveLakeFile(context.local, "Catalog.lean", "import Units\ndef Catalog.quote (value : UInt32) : UInt32 := value + 20\n");
		return { stdout: "", stderr: "", code: 0 };
	} };
	const outputRoot = join(context.directory, "gate");
	const before = await lakeInputState(context.workspace);
	const run = () => runComponentReproducibilityGate({ projectRoot: context.root
		, outputRoot, engineRoot, targets: ["npm"]
		, environment: { LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: resolve(runtimeRoot) }
		, build: options => buildCanonicalProject({ ...options, runner }) });
	if(drift)
	{
		await assert.rejects(run, { code: "lake-source-drift" });
		assert.equal(JSON.parse(await readFile(join(outputRoot, "evidence/reproducibility.json"), "utf8")).result, "failed");
	}
	else
	{
		const result = await run();
		assert.equal(result.result, "passed");
		assert.equal(result.externalRegistryWrites, false);
		await verifyPublishManifest({ manifestPath: result.publishManifest });
		await verifyComponentPackageReceipt({ receiptPath: result.receipt.path });
		assert.equal((await execute("tar", ["-xOf", result.packages.component, "package/notices/lake/Catalog/NOTICE"])).stdout, "Catalog dependency notice\n");
		assert.equal(sha256(canonicalJson(await lakeInputState(context.workspace))), sha256(canonicalJson(before)), "Release gate changed author files or Git metadata");
	}
	assert.equal(builds, 2);
});

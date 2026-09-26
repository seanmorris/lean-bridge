/**
 * Source-free owned C archives from ordinary and independently reviewed Lean APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { generateOwnedAggregateCarriers } from "../src/build/owned-aggregate-carriers.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildNativeProject } from "../src/build/native-project.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const enabled = process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST === "1";

test("owned package models require explicit capability and preserve their carrier identity", async () => {
	// Retained compiler output exercises model reconstruction, not a new execution.
	const record = await json("docs/evidence/owned-reviewed-execution-20260926.json");
	const input = record.inputs.reviewed;
	assert.throws(() => createCompiledNativeModel(input));
	const model = createCompiledNativeModel(input, { ownedGraphs: true });
	assert.equal(model.schemaVersion, 6); assert.equal(model.ownedGraph.schemaVersion, 1);
	assert.equal(model.exports.length, 22);
	const adapters = generateCompiledNativeLeanAdapters(model), original = generateOwnedAggregateCarriers(input);
	assert.equal(adapters.leanSource, original.leanSource);
	assert.equal(adapters.header, original.header);
	for(const mutate of [
		value => { value.bindingIrSha256 = "0".repeat(64); }
		, value => { value.ownedGraph.module += "Other"; }
		, value => { value.exports[0].symbol += "_other"; }
		, value => { value.pointerBits = 32; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateCompiledNativeLeanAdapters(changed));
	}
	assert.throws(() => createCompiledNativeModel({ ...input, moduleName: "Hidden::Perl" }, { ownedGraphs: true }));
	const primitive = { ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	assert.deepEqual(createCompiledNativeModel(primitive, { ownedGraphs: true }), createCompiledNativeModel(primitive));
});

test("unsupported native targets reject owned source decisions before compiling", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-admission-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	for(const targets of [["cpp"], ["c", "cpp"], ["pypi"], ["cpan"]])
		await assert.rejects(buildNativeProject({ projectRoot: project, targets
			, outputRoot: join(directory, "unused")
			, environment: copiedCleanEnvironment }), /ownedAggregates/);
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Owned"] }));
	await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedAggregateReviewedIr()));
	await assert.rejects(buildNativeProject({ projectRoot: project
		, targets: ["cpp"], outputRoot: join(directory, "unused")
		, environment: copiedCleanEnvironment }), { code: "consumer-upgrade-required" });
	await assert.rejects(access(join(directory, "unused")), { code: "ENOENT" });
});

for(const mode of ["ordinary", "reviewed"]) test(`installed owned C package from ${mode} Lean runs without producer sources`, { skip: !enabled, timeout: 1_200_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "owned-archive", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedAggregateReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c"]);
	let built;
	try
	{
		built = await buildCanonicalProject({ projectRoot: project
			, outputRoot: output, targets: ["c"], environment
			, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) });
	} catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(built.backend, "native-c-owned-v1");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity));
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true });
	assert.equal(model.bindingIr.schemaVersion, 4); assert.equal(model.exports.length, 22);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const adapterRoot = join(output, "native/owned-c-binding");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedNativeC({ working: reassembled, adapterRoot
		, nativeRoot, runtimeRoot, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.c
		, glibcMinimumVersion: built.glibcMinimumVersion });
	assert.deepEqual(rebuilt.packages, built.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", built.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const headerPath = "include/owned_aggregates.h", header = await readFile(join(adapterRoot, headerPath));
	const changed = Buffer.concat([header, Buffer.from("\n/* Modified after compilation. */\n")]);
	await saveLakeFile(adapterRoot, headerPath, changed);
	const forged = structuredClone(adapter);
	forged.files[headerPath] = { bytes: changed.length, sha256: sha256(changed) };
	forged.ownedValues.headerSha256 = sha256(changed);
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
	await assert.rejects(packageOwnedNativeC({ working: join(directory, "forged")
		, adapterRoot, nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, glibcMinimumVersion: "2.38" }), /compiler-authenticated/);
	await saveLakeFile(adapterRoot, headerPath, header);
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true });
	await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" });
	await assert.rejects(access(output), { code: "ENOENT" });
	const receiptPath = join(handoff, "package-set-receipt.json");
	await verifyPackageSetReceipt({ receiptPath });
	const observed = await installCopiedConsumer({ profile: "c", consumer, handoff
		, packages: receipt.packages, environment
		, fixture: { source: () => readFile("tests/fixtures/structured-types/owned-installed-values.c", "utf8"), success: "owned-installed" } });
	assert.ok(observed.checks >= 300);
	const cRoot = join(consumer, "c"), installed = join(cRoot, "owned-archive-1.2.3-c");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.ownedValues.schemaVersion, 1);
	for(const path of ["include/gmp.h", "lib/libgmp.so.10"
		, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, "share/lean-bridge/licenses/GMP-COPYING.LESSERv3"
		, "share/lean-bridge/licenses/Lean-LICENSE"
		, "share/lean-bridge/component/binding-ir.json"])
		assert.ok(manifest.files[path], path);
	await verifyNativeFiles(installed, manifest.files);
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
	await saveLakeFile(cRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(OwnedConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnv = { ...copiedCleanEnvironment, PATH: join(cRoot, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", cRoot, "-B", "cmake-build"
		, "-G", "Unix Makefiles"
		, "-DCMAKE_C_COMPILER=/usr/bin/cc", "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], cRoot, compileEnv);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cRoot, compileEnv);
	const cmake = await runCopied(join(cRoot, "cmake-build/consumer"), [], cRoot);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-installed:${observed.checks}\n`);
	await saveLakeFile(resolve("build/owned-c-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, forgedHeaderRejected: true
		, input: { component: model.component, sourceIdentity: model.sourceIdentity
			, metadata }
		, nativeModelSha256: sha256(canonicalJson(model)), componentReceipt
		, adapterReceipt: adapter, packageSetReceipt: receipt
		, manifest, consumerSha256: observed.consumerSha256
		, checks: { pkgConfig: observed.checks, cmake: observed.checks }
	}));
	t.diagnostic(`${mode}: ${observed.checks} public checks with pkg-config and again with relocated CMake; producer removed`);
});

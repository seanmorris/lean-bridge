/**
 * Installed call-scoped C callbacks with resource-containing arguments and replies.
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
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const capability = { ownedGraphs: true, ownedHostCallbacks: true };
const enabled = process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST === "1";

test("owned host native models authenticate callback signatures, recovery and capability versions", async () => {
	// Retained compiler output checks reconstruction, not fresh execution.
	const { inputs: { reviewed: input } } = await json("docs/evidence/owned-reviewed-execution-20260926.json");
	const previous = createCompiledNativeModel(input, { ownedGraphs: true });
	const model = createCompiledNativeModel(input, capability);
	assert.equal(previous.schemaVersion, 6); assert.equal(previous.ownedGraph.schemaVersion, 1);
	assert.equal(model.schemaVersion, 7); assert.equal(model.ownedGraph.schemaVersion, 2);
	assert.notEqual(model.ownedGraph.module, previous.ownedGraph.module);
	const adapters = generateCompiledNativeLeanAdapters(model);
	const expected = generateOwnedAggregateCarriers({ ...input, hostCallbacks: true });
	assert.equal(adapters.leanSource, expected.leanSource); assert.equal(adapters.header, expected.header);
	assert.equal(adapters.callbackSource, expected.callbackSource.replace('#include "carriers.h"', '#include "component.h"'));
	assert.equal(model.ownedGraph.hostCallbacks.trampolineSha256, sha256(adapters.callbackSource));
	assert.throws(() => createCompiledNativeModel(input, { ownedHostCallbacks: true }));
	assert.throws(() => createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: "yes" }));
	for(const mutate of [
		value => { value.schemaVersion = 6; value.ownedGraph.schemaVersion = 1; delete value.ownedGraph.hostCallbacks; }
		, value => { value.schemaVersion = 8; }
		, value => { value.ownedGraph.schemaVersion = 1; }
		, value => { delete value.ownedGraph.hostCallbacks; }
		, value => { value.ownedGraph.hostCallbacks.schemaVersion = 2; }
		, value => { value.ownedGraph.hostCallbacks.lifetime = "retained"; }
		, value => { value.ownedGraph.hostCallbacks.recovery = "unchecked"; }
		, value => { value.ownedGraph.hostCallbacks.extra = true; }
		, value => { value.ownedGraph.hostCallbacks.signatures[0].automaticRecovery = false; }
		, value => { value.ownedGraph.hostCallbacks.signatures[0].symbol += "changed"; }
		, value => { value.ownedGraph.hostCallbacks.trampolineSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateCompiledNativeLeanAdapters(changed));
	}
});

test("CI builds and installs owned host callback packages on both source paths", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-host-packaging.test.mjs";
	assert.ok(workflow.includes("          " + command + "\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	for(const mode of ["ordinary", "reviewed"])
	{
		assert.ok(workflow.includes(`test -s build/owned-host-packaging/${mode}.json`));
		assert.ok(workflow.includes(`            build/owned-host-packaging/${mode}.json\n`));
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`installed owned host callbacks from ${mode} Lean preserve ownership without producer sources`, { skip: !enabled, timeout: 1_200_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-host-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-host-callbacks"), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "owned-callback-archive", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedHostCallbackReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c"]);
	let built;
	try
	{
		built = await buildCanonicalProject({ projectRoot: project, outputRoot: output
			, targets: ["c"], environment
			, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) });
	} catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(built.backend, "native-c-owned-v2");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity), { code: "native-owned-callbacks-unavailable" });
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true }), { code: "native-owned-callbacks-unavailable" });
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, capability);
	assert.equal(model.schemaVersion, 7); assert.equal(model.ownedGraph.schemaVersion, 2);
	assert.equal(componentReceipt.schemaVersion, 3); assert.equal(model.exports.length, 11);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const callbackSource = await readFile(join(nativeRoot, "callbacks.c"));
	assert.equal(componentReceipt.callbackSourceSha256, sha256(callbackSource));
	assert.ok(model.ownedGraph.hostCallbacks.signatures.some(item => !item.automaticRecovery));
	const adapterRoot = join(output, "native/owned-c-binding");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	assert.equal(adapter.schemaVersion, 3); assert.equal(adapter.ownedValues.schemaVersion, 2);
	assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const inventory = await json(join(nativeRoot, "artifacts.json"));
	// Recompute every asserted digest after forgery. Regeneration, not a stale hash,
	// must reject invented recovery rules and modified callback implementations.
	for(const mutation of ["capability", "trampoline"])
	{
		const claimed = structuredClone(model), receipt = structuredClone(componentReceipt);
		const files = structuredClone(inventory), changed = {};
		if(mutation === "capability") claimed.ownedGraph.hostCallbacks.lifetime = "retained";
		else
		{
			changed["callbacks.c"] = Buffer.concat([callbackSource, Buffer.from("\n/* forged trampoline */\n")]);
			receipt.callbackSourceSha256 = sha256(changed["callbacks.c"]);
		}
		receipt.modelSha256 = sha256(canonicalJson(claimed));
		changed["model.json"] = Buffer.from(canonicalJson(claimed));
		changed["native-component.json"] = Buffer.from(canonicalJson(receipt));
		for(const [path, bytes] of Object.entries(changed))
		{
			await saveLakeFile(nativeRoot, path, bytes);
			files.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
		await saveLakeFile(nativeRoot, "artifacts.json", canonicalJson(files));
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, capability), /compiler/);
		await saveLakeFile(nativeRoot, "model.json", canonicalJson(model));
		await saveLakeFile(nativeRoot, "native-component.json", canonicalJson(componentReceipt));
		await saveLakeFile(nativeRoot, "callbacks.c", callbackSource);
		await saveLakeFile(nativeRoot, "artifacts.json", canonicalJson(inventory));
	}
	const packageOptions = { adapterRoot, nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, settings: config.targets.c
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const forged = structuredClone(adapter); forged.ownedValues.hostCallbacks.lifetime = "retained";
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
	await assert.rejects(packageOwnedNativeC({ ...packageOptions, working: join(directory, "forged") }), /compiler-authenticated/);
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedNativeC({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, built.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", built.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observed = await installCopiedConsumer({ profile: "c", consumer, handoff
		, packages: receipt.packages, environment
		, fixture: { source: () => readFile("tests/fixtures/structured-types/owned-installed-host-callbacks.c", "utf8"), success: "owned-installed-callbacks" } });
	assert.ok(observed.checks >= 600);
	const cRoot = join(consumer, "c"), installed = join(cRoot, "owned-callback-archive-1.2.3-c");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 3); assert.equal(manifest.ownedValues.schemaVersion, 2);
	assert.deepEqual(manifest.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	assert.equal(manifest.files["share/lean-bridge/component/callbacks.c"].sha256, sha256(callbackSource));
	await verifyNativeFiles(installed, manifest.files);
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
	await saveLakeFile(cRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(OwnedHostConsumer C)
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
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-installed-callbacks:${observed.checks}\n`);
	await saveLakeFile(resolve("build/owned-host-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, forgedCapabilityRejected: true, forgedTrampolineRejected: true
		, forgedAdapterRejected: true
		, input: { component: model.component, sourceIdentity: model.sourceIdentity, metadata }
		, nativeModelSha256: sha256(canonicalJson(model)), componentReceipt
		, adapterReceipt: adapter, packageSetReceipt: receipt, manifest
		, consumerSha256: observed.consumerSha256
		, checks: { pkgConfig: observed.checks, cmake: observed.checks }
	}));
	t.diagnostic(`${mode}: ${observed.checks} installed callback checks with pkg-config and relocated CMake; producer removed`);
});

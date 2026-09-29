/**
 * Install compiler-authenticated input transfers without producer sources or Lean.
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
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime } from "../src/build/native-artifacts.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedTransferReviewedIr, ownedTransferConfiguration, ownedTransferSource } from "./helpers/owned-transfer-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true };

test("owned native transfer models authenticate the complete move contract", async () => {
	const record = await json("docs/evidence/owned-transfer-c-20260929.json");
	for(const { input } of record.consumers)
	{
		assert.throws(() => createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true }), { code: "native-owned-transfers-unavailable" });
		assert.throws(() => createCompiledNativeModel(input, { ownedInputTransfers: true }), /ownership-aware/u);
		assert.throws(() => createCompiledNativeModel(input, { ...capabilities, ownedInputTransfers: "true" }), /must be explicit/u);
		const model = createCompiledNativeModel(input, capabilities);
		assert.equal(model.schemaVersion, 8); assert.equal(model.ownedGraph.schemaVersion, 3);
		const contract = model.ownedGraph.inputTransfers;
		assert.equal(contract.exports.length, 18);
		assert.deepEqual(contract.exports.find(item => item.bindingId === "lean:Owned.bundle").parameters, [0, 2]);
		assert.equal(contract.ownership, "whole-result-owner");
		assert.equal(contract.consumption, "before-lean-call");
		assert.equal(contract.failure, "consumed-after-handoff");
		assert.ok(generateCompiledNativeLeanAdapters(model).callbackSource);
		for(const mutate of [
			value => { delete value.ownedGraph.inputTransfers; }
			, value => { value.ownedGraph.inputTransfers.exports.pop(); }
			, value => { value.ownedGraph.inputTransfers.exports[0].parameters = []; }
			, value => { value.ownedGraph.inputTransfers.consumption = "after-lean-call"; }
			, value => { value.ownedGraph.inputTransfers.failure = "restore-owners"; }
			, value => { value.schemaVersion = 7; value.ownedGraph.schemaVersion = 2; }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateCompiledNativeLeanAdapters(changed));
		}
		const withoutCallbacks = createCompiledNativeModel(input, { ...capabilities, ownedHostCallbacks: false });
		assert.equal(withoutCallbacks.schemaVersion, 8);
		assert.equal(generateCompiledNativeLeanAdapters(withoutCallbacks).callbackSource, undefined);
	}
	const old = (await json("docs/evidence/owned-reviewed-execution-20260926.json")).inputs.reviewed;
	for(const ownedHostCallbacks of [false, true])
		assert.deepEqual(createCompiledNativeModel(old, { ...capabilities, ownedHostCallbacks }), createCompiledNativeModel(old, { ownedGraphs: true, ownedHostCallbacks }));
});

for(const mode of ["ordinary", "reviewed"]) test(`installed ${mode} C transfers survive source removal and package relocation`, {
	skip: process.env.LEAN_BRIDGE_OWNED_TRANSFER_PACKAGE_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-transfer-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedTransferSource);
	const config = mode === "ordinary" ? await ownedTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "owned-transfers", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedTransferReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c"]);
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: ["c"], environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => {
			throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error });
		});
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(built.backend, "native-c-owned-v3");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true }), { code: "native-owned-transfers-unavailable" });
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedInputTransfers: true }), { code: "native-owned-callbacks-unavailable" });
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, capabilities);
	assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 24);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.deepEqual(componentReceipt.inputTransfers, model.ownedGraph.inputTransfers);
	const adapterRoot = join(output, "native/owned-c-binding");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const packaging = { adapterRoot, nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.c
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedNativeC({ ...packaging, working: reassembled });
	assert.deepEqual(rebuilt.packages, built.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", built.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	await assert.rejects(packageOwnedNativeC({ ...packaging, working: join(directory, "unsupported-cpp"), target: "cpp" }), { code: "native-owned-transfers-unavailable" });
	for(const mutate of [
		value => { delete value.ownedValues.inputTransfers; }
		, value => { value.ownedValues.inputTransfers.exports[0].parameters = []; }
		, value => { value.ownedValues.inputTransfers.consumption = "after-lean-call"; }
	]) {
		const forged = structuredClone(adapter); mutate(forged);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNativeC({ ...packaging, working: join(directory, "forged") }), /compiler-authenticated/u);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	const values = generateOwnedCValues(model.bindingIr, { hostCallbacks: true, transferredInputs: true });
	const macros = [["OPTION", "echoOption"], ["ARRAY", "echoArray"]
		, ["LIST", "echoList"], ["RESULT", "echoResult"]
		, ["TUPLE", "echoTuple"], ["ROW", "echoRow"], ["NESTED", "echoNested"]]
		.map(([macro, name]) => {
			const type = values.functions.find(item => item.name === name).parameters[0];
			return `#define COPY_${macro} ${values.copies.find(item => item.id === type).cName}`;
		}).join("\n") + "\n";
	const fixture = await readFile("tests/fixtures/structured-types/owned-installed-transfers.c", "utf8");
	const source = macros + fixture;
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true });
	await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" });
	await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observed = await installCopiedConsumer({ profile: "c", consumer, handoff
		, packages: receipt.packages, environment
		, fixture: { source: () => source, success: "owned-transfers-installed" } });
	assert.ok(observed.checks > 300);
	const cRoot = join(consumer, "c"), installed = join(cRoot, "owned-transfers-1.2.3-c");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 4); assert.equal(manifest.ownedValues.schemaVersion, 3);
	assert.deepEqual(manifest.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
	assert.match(await readFile(join(installed, "README.md"), "utf8"), /later failures leave them\nconsumed/u);
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
	await saveLakeFile(cRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(TransferConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnv = { ...copiedCleanEnvironment, PATH: join(cRoot, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", cRoot, "-B", "cmake-build"
		, "-G", "Unix Makefiles", "-DCMAKE_C_COMPILER=/usr/bin/cc"
		, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], cRoot, compileEnv);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cRoot, compileEnv);
	const cmake = await runCopied(join(cRoot, "cmake-build/consumer"), [], cRoot);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-transfers-installed:${observed.checks}\n`);
	await saveLakeFile(resolve("build/owned-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, transferIncapableReaderRejected: true, forgedMoveContractRejected: true
		, input: { component: model.component, sourceIdentity: model.sourceIdentity, metadata }
		, model, componentReceipt, adapterReceipt: adapter
		, packageSetReceipt: receipt, manifest
		, consumerSha256: observed.consumerSha256, fixtureSha256: sha256(fixture)
		, checks: { pkgConfig: observed.checks, cmake: observed.checks }
	}));
	t.diagnostic(`${mode}: ${observed.checks} installed transfer checks using pkg-config and relocated CMake`);
});

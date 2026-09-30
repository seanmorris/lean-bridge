/**
 * Install original-owner result contracts without Lean or producer directories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime } from "../src/build/native-artifacts.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedBorrowReviewedIr, ownedBorrowConfiguration, ownedBorrowSource } from "./helpers/owned-borrow-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };

for(const mode of ["ordinary", "reviewed"]) test(`installed ${mode} C borrowed results retain their original owner contract after relocation`, {
	skip: process.env.LEAN_BRIDGE_OWNED_BORROW_PACKAGE_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-borrow-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedBorrowSource);
	const config = mode === "ordinary" ? await ownedBorrowConfiguration({ mixed: true }) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "owned-borrows", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedBorrowReviewedIr({ mixed: true })));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c"]);
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: ["c"], environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(built.backend, "native-c-owned-v4");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedAnchoredResults: false }), { code: "native-owned-anchors-unavailable" });
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedAnchoredResults: "true" }), { code: "native-owned-anchors-unavailable" });
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedInputTransfers: false }), { code: "native-owned-transfers-unavailable" });
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedHostCallbacks: false }), { code: "native-owned-callbacks-unavailable" });
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, capabilities);
	assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 24);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
	assert.deepEqual(componentReceipt.resultAnchors, model.ownedGraph.resultAnchors);
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
	await assert.rejects(packageOwnedNativeC({ ...packaging, working: join(directory, "unsupported-cpp"), target: "cpp" }), { code: "native-owned-anchors-unavailable" });
	const mutations = [
		value => { delete value.ownedValues.resultAnchors; }
		, value => { value.ownedValues.resultAnchors.exports.pop(); }
		, value => { value.ownedValues.resultAnchors.exports[0].parameter = 999; }
		, value => { value.ownedValues.resultAnchors.expiration = "session-close"; }
		, value => { value.ownedValues.resultAnchors.descendants = "independent"; }
		, value => { value.ownedValues.resultAnchors.maximumDepth = 256; }
		, value => { value.schemaVersion = 4; value.ownedValues.schemaVersion = 3; }
	];
	for(const mutate of mutations)
	{
		const forged = structuredClone(adapter); mutate(forged);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNativeC({ ...packaging, working: join(directory, "forged") }), /compiler-authenticated/u);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	const values = generateOwnedCValues(model.bindingIr, { hostCallbacks: true, transferredInputs: true, anchoredResults: true });
	const copies = [
		["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
		, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"], ["ROW", "echoRow"]
		, ["NESTED", "echoNested"]
	];
	const macros = copies.map(([macro, name]) => {
		const type = values.functions.find(item => item.name === name).parameters[0];
		return `#define COPY_${macro} ${values.copies.find(item => item.id === type).cName}`;
	}).join("\n");
	const fixture = await readFile("tests/fixtures/structured-types/owned-public-borrows.c", "utf8");
	assert.equal(fixture.split('#include "borrow-copies.h"').length, 2);
	const source = "#define LEAN_BRIDGE_BORROW_INSTALLED 1\n" + fixture.replace('#include "borrow-copies.h"', macros);
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true });
	await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" });
	await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observed = await installCopiedConsumer({ profile: "c", consumer, handoff
		, packages: receipt.packages, environment
		, fixture: { source: () => source, success: "owned-borrows-installed" } });
	assert.ok(observed.checks > 900);
	const cRoot = join(consumer, "c"), installed = join(cRoot, "owned-borrows-1.2.3-c");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.ownedValues.schemaVersion, 4);
	assert.deepEqual(manifest.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
	assert.match(await readFile(join(installed, "README.md"), "utf8"), /raw C field reads do not\nperform validation/u);
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
	await saveLakeFile(cRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(BorrowConsumer C)
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
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-borrows-installed:${observed.checks}\n`);
	const page = await readFile("docs/consume/c.md", "utf8");
	const example = page.split("### Borrowed results\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example); await saveLakeFile(cRoot, "borrow.c", example);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], cRoot
		, { ...compileEnv, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "borrow.c", ...flags, "-o", "borrow"], cRoot, compileEnv);
	const documentation = await runCopied(join(cRoot, "borrow"), [], cRoot);
	assert.equal(documentation.stderr, ""); assert.equal(documentation.stdout, "42\n");
	await saveLakeFile(resolve("build/owned-borrows"), `installed-${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, incapableReadersRejected: 4, forgedAnchorContractsRejected: mutations.length
		, input: { component: model.component, sourceIdentity: model.sourceIdentity, metadata }
		, model, componentReceipt, adapterReceipt: adapter
		, packageSetReceipt: receipt, manifest
		, consumerSha256: observed.consumerSha256, fixtureSha256: sha256(fixture)
		, checks: { pkgConfig: observed.checks, cmake: observed.checks }
		, documentation: { sourceSha256: sha256(example), stdout: documentation.stdout }
	}));
	t.diagnostic(`${mode}: ${observed.checks} installed borrow checks using pkg-config and relocated CMake`);
});

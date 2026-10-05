/**
 * Source-free C++ transfer packages from ordinary and reviewed Lean APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedTransferReviewedIr, ownedTransferConfiguration, ownedTransferSource } from "./helpers/owned-transfer-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const enabled = process.env.LEAN_BRIDGE_OWNED_CPP_TRANSFER_TEST === "1";

for(const mode of ["ordinary", "reviewed"]) test(`installed C++ transfer packages preserve explicit moves (${mode})`, { skip: !enabled, timeout: 1_200_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-cpp-transfer-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedTransferSource);
	const config = mode === "ordinary" ? await ownedTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "owned-transfer-c", version: "1.2.3" }, cpp: { name: "owned-transfer-cpp", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedTransferReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c", "cpp"]);
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: ["c", "cpp"], environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections.find(item => item.ecosystem === "cpp");
	assert.equal(projection.backend, "native-cpp-owned-v3");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
	assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 24);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const metadata = await json(join(nativeRoot, "metadata.json")), adapterRoot = join(output, "native/owned-c-binding");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const generated = generateOwnedCppPackage(model.bindingIr, { transferredInputs: true });
	assert.deepEqual(adapter.cppValues, generated.contract); assert.equal(adapter.schemaVersion, 4);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, {
		ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: false
	})
	, { code: "native-owned-transfers-unavailable" });
	const packaging = { adapterRoot, nativeRoot, runtimeRoot, target: "cpp"
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.cpp
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	for(const field of ["consumption", "arguments", "independentRetains"])
	{
		const forged = structuredClone(adapter); forged.cppValues.inputTransfers[field] = "forged";
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNativeC({ ...packaging, working: join(directory, `forged-${field}`) }), /compiler-authenticated/u);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedNativeC({ ...packaging, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const fixture = await readFile("tests/fixtures/structured-types/owned-cpp-transfers.cpp", "utf8");
	const source = "#define OWNED_TRANSFER_INSTALLED 1\n" + fixture;
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observed = await installCopiedConsumer({ profile: "cpp", consumer
		, handoff, environment
		, packages: receipt.packages.filter(item => item.target === "cpp")
		, fixture: { source: () => source, success: "owned-cpp-transfers-installed" } });
	assert.ok(observed.checks >= 70);
	const cppRoot = join(consumer, "cpp"), installed = join(cppRoot, "owned-transfer-cpp-1.2.3-cpp");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 4); assert.deepEqual(manifest.cppValues, generated.contract);
	assert.deepEqual(manifest.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
	assert.match(await readFile(join(installed, "README.md"), "utf8"), /Transferred inputs take rvalue references/u);
	await verifyNativeFiles(installed, manifest.files);
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
	await saveLakeFile(cppRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(TransferCppConsumer CXX)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.cpp)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnv = { ...copiedCleanEnvironment, PATH: join(cppRoot, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", cppRoot, "-B", "cmake-build"
		, "-G", "Unix Makefiles", "-DCMAKE_CXX_COMPILER=/usr/bin/c++"
		, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], cppRoot, compileEnv);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cppRoot, compileEnv);
	const cmake = await runCopied(join(cppRoot, "cmake-build/consumer"), [], cppRoot);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-cpp-transfers-installed:${observed.checks}\n`);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], cppRoot
		, { ...compileEnv, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	const documentation = (await readFile("docs/consume/cpp.md", "utf8")).match(/```cpp file=cpp\/owned-transfers\.cpp\n([\s\S]*?)```/u)?.[1];
	assert.ok(documentation); await saveLakeFile(cppRoot, "documentation.cpp", documentation);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra"
		, "-Werror", "documentation.cpp", ...flags, "-o", "documentation"]
	, cppRoot, compileEnv);
	const documented = await runCopied(join(cppRoot, "documentation"), [], cppRoot);
	assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "transferred\n");
	await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fsanitize=address,undefined"
		, "-fno-omit-frame-pointer", "-no-pie", "consumer.cpp"
		, ...flags, "-o", "consumer-sanitized"], cppRoot, compileEnv);
	const runSanitized = extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "owned-cpp-transfers", join(cppRoot, "consumer-sanitized")], cppRoot
		, { ...copiedCleanEnvironment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", LSAN_OPTIONS: "exitcode=0", ...extra });
	const cold = await runSanitized({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), sanitized = await runSanitized({});
	assert.equal(cold.stdout, "cold\n"); assert.equal(sanitized.stdout, cmake.stdout);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(directory, "<probe>");
	assert.doesNotMatch(sanitized.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(sanitized.stderr), normalize(cold.stderr));
	await saveLakeFile(resolve("build/owned-cpp-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, transferIncapableReaderRejected: true, forgedMoveContractsRejected: true
		, input: { component: model.component, sourceIdentity: model.sourceIdentity, metadata }
		, model, componentReceipt, adapterReceipt: adapter
		, packageSetReceipt: receipt, manifest, fixtureSha256: sha256(fixture)
		, consumerSha256: observed.consumerSha256
		, documentation: { sourceSha256: sha256(documentation), stdout: documented.stdout }
		, checks: { pkgConfig: observed.checks, cmake: observed.checks, sanitized: observed.checks }
		, startupLeakBaseline: normalize(cold.stderr)
	}));
	t.diagnostic(`${mode}: ${observed.checks} installed C++ transfer checks using pkg-config, relocated CMake and sanitizers`);
});

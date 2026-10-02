/**
 * Callback-owned C++ values survive source-free installation and relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedNativeCFamily } from "../src/build/owned-c-projection.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource
	, ownedCallbackResultCombinedConfiguration, ownedCallbackResultCombinedReviewedIr, ownedCallbackResultCombinedSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`installed callback-result C++ archive (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CPP_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-cpp-callback-result-installed-${mode}-${combined}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(directory, "source");
	const output = join(directory, "producer"), handoff = join(directory, "handoff");
	const candidate = combined ? await buildCliNpmPackage({ outputRoot: join(directory, "cli") }) : null;
	await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
	if(candidate)
	{
		await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", candidate.archive], cwd: author });
		const cliRoot = join(author, "node_modules", candidate.report.package.name);
		for(const file of candidate.report.files)
		{
			const bytes = await readFile(join(cliRoot, file.path));
			assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
		}
		await rm(candidate.output, { recursive: true });
	}
	const cli = join(author, "node_modules/.bin/lean-bridge");
	await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + (combined ? ownedCallbackResultCombinedSource : ownedCallbackResultSource));
	const configuration = mode === "ordinary" ? await (combined ? ownedCallbackResultCombinedConfiguration : ownedCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	const reviewed = (combined ? ownedCallbackResultCombinedReviewedIr : ownedCallbackResultReviewedIr)();
	if(!combined)
	{
		const omitted = ["callbackRecord", "callbackRecursive"];
		reviewed.declarations = reviewed.declarations.filter(item => !omitted.includes(item.name));
		reviewed.types = reviewed.types.filter(type => type.kind !== "callback" || type.callable.parameters.length > 1);
		if(mode === "ordinary") for(const name of omitted)
		{
			configuration.exports = configuration.exports.filter(value => value !== "Owned." + name);
			delete configuration.arities["Owned." + name]; delete configuration.contracts["Owned." + name];
		}
	}
	configuration.targets = { cpp: { name: "owned-cpp-callback-results", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(reviewed));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["cpp"]), builds = [];
	for(const name of ["NODE_PATH", "NODE_OPTIONS"]) delete environment[name];
	const build = async destination => {
		t.diagnostic(`${mode}: ${combined ? "installed CLI" : "native producer"} builds ${destination}`);
		if(!combined)
		{
			// The CLI enables callback transport. Exercise an explicit false
			// capability through the native producer, including packaged retention.
			const runtimeRoot = join(destination, "native/runtime"), nativeRoot = join(destination, "native/component");
			const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
			await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
			const native = await buildNativeComponent({ projectRoot: project
				, outputRoot: nativeRoot, runtimeRoot, leanPrefix, targets: ["cpp"]
				, ownedGraphs: true, ownedHostCallbacks: false
				, ownedCallbackResultAnchors: true });
			const projections = await projectOwnedNativeCFamily({ working: destination
				, nativeRoot, runtimeRoot, leanPrefix, targets: ["cpp"]
				, settings: configuration.targets, environment });
			await writeNativePackageSet({ root: destination, model: native.model
				, runtimeIdentity: native.receipt.runtimeIdentity, projections });
			assert.deepEqual(await lakeInputState(project), before);
			builds.push({ producerInterface: "native-build-api", projections });
			return projections[0];
		}
		const result = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, "--target", "cpp", "--output", destination, "--json"]
			, cwd: directory, env: environment, timeoutMs: 900000 })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.deepEqual(response.result.targets, ["cpp"]); builds.push(response);
		assert.deepEqual(await lakeInputState(project), before);
		return json(join(destination, "native-release.json"));
	};
	const built = await build(output); assert.equal(built.backend, "native-cpp-owned-v6");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const adapterRoot = join(output, "native/owned-c-binding");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: combined
		, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined };
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, capabilities), { code: "native-owned-callback-anchors-unavailable" });
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedCallbackResultAnchors: true });
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, combined ? 4 : 2);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	if(!combined) await assert.rejects(access(join(nativeRoot, "callbacks.c")), { code: "ENOENT" });
	for(const key of ["hostCallbacks", "resultAnchors", "inputTransfers", "receiverExports"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	const generated = generateOwnedCppPackage(model.bindingIr, {
		hostCallbacks: combined, callbackResultAnchors: true
		, anchoredResults: combined, transferredInputs: combined
		, receiverExports: combined
	});
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const metadata = await json(join(nativeRoot, "metadata.json"));
	assert.deepEqual(adapter.cppValues, generated.contract); assert.equal(adapter.cppValues.schemaVersion, 5);
	assert.equal(adapter.schemaVersion, 7); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.deepEqual(adapter.ownedValues.callbackResultAnchors, model.ownedGraph.callbackResultAnchors);
	const packageOptions = { adapterRoot, nativeRoot, runtimeRoot, target: "cpp"
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.cpp
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedNativeC({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, built.packages);
	const archive = await readFile(join(output, "archives", built.packages[0].archive));
	assert.deepEqual(await readFile(join(reassembled, "archives", built.packages[0].archive)), archive);
	await rm(reassembled, { recursive: true });
	const repeated = join(directory, "repeated"), second = await build(repeated);
	assert.deepEqual(second.packages, built.packages);
	assert.deepEqual(await readFile(join(repeated, "archives", built.packages[0].archive)), archive);
	await rm(repeated, { recursive: true });
	t.diagnostic(`${mode}: independent build and deterministic reassembly match`);
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.callbackResultAnchors; }
		, value => { value.ownedValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.ownedValues.callbackResultAnchors.signatures[0].parameter += 1; }
		, value => { value.ownedValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.ownedValues.callbackResultAnchors.expiration = "never"; }
		, value => { value.ownedValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.ownedValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.ownedValues.callbackResultAnchors.unknown = true; }
		, value => { value.schemaVersion = 6; }
		, value => { value.ownedValues.schemaVersion = 5; }
		, value => { delete value.cppValues.callbackResultAnchors; }
		, value => { value.cppValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.cppValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.cppValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.cppValues.callbackResultAnchors.parameterNumbering = "includes-closure"; }
		, value => { value.cppValues.callbackResultAnchors.hostReply = "unchecked"; }
		, value => { value.cppValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.cppValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.cppValues.callbackResultAnchors.emptyValues = "unowned"; }
		, value => { value.cppValues.schemaVersion = 4; }
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(changed));
		await assert.rejects(packageOwnedNativeC({ ...packageOptions, working: join(directory, "forged") }), /compiler-authenticated|Owned C\+\+ adapter differs/u);
		rejected++;
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	const generatedSources = Object.keys(adapter.files).filter(path => /^(?:src|include)\/owned_aggregates(?:[.-]|$)/u.test(path)).sort();
	assert.equal(generatedSources.length, 6);
	const vendoredSources = ["include/boost/multiprecision/cpp_int.hpp"];
	for(const path of vendoredSources) assert.ok(Object.hasOwn(adapter.files, path), path);
	// Exercise every generated file and the same verification path for a vendor
	// header. Manifest verification still hashes every installed vendor file.
	for(const path of [...generatedSources, ...vendoredSources])
	{
		const original = await readFile(join(adapterRoot, path));
		const changed = Buffer.concat([original, Buffer.from("\n/* changed callback ownership */\n")]);
		const forged = structuredClone(adapter); forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNativeC({ ...packageOptions, working: join(directory, "forged") }), /generated source differs/u);
		rejected++;
		await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	t.diagnostic(`${mode}: ${rejected} contract and source forgeries rejected`);
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	for(const path of [project, output, author])
	{
		await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" });
	}
	const source = `#define CALLBACK_RESULTS_INSTALLED 1\n#define HOST_CALLBACKS ${Number(combined)}\n#define COMBINED ${Number(combined)}\n`
		+ await readFile("tests/fixtures/structured-types/owned-cpp-callback-results.cpp", "utf8");
	const consumer = join(directory, "consumer"), installed = await installCopiedConsumer({
		profile: "cpp", consumer, handoff, environment
		, packages: handoffReceipt.packages
		, fixture: { source: () => source
			, success: "owned-cpp-callback-results-installed"
			, expectedChecks: combined ? 76 : 53 } });
	const root = join(consumer, "cpp"), packageRoot = join(root, "owned-cpp-callback-results-1.2.3-cpp");
	const manifest = await json(join(packageRoot, "lean-bridge-package.json"));
	assert.deepEqual(manifest.cppValues, generated.contract);
	assert.equal(manifest.schemaVersion, 7); assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
	assert.match(await readFile(join(packageRoot, "README.md"), "utf8"), /selected argument's original owner/u);
	await verifyNativeFiles(packageRoot, manifest.files);
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated"); await rename(packageRoot, relocated);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(CallbackResultConsumer CXX)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.cpp)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnvironment = { ...copiedCleanEnvironment, PATH: join(root, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", root, "-B", "cmake-build"
		, "-G", "Unix Makefiles"
		, "-DCMAKE_CXX_COMPILER=/usr/bin/c++", "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], root, compileEnvironment);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], root, compileEnvironment);
	const cmake = await runCopied(join(root, "cmake-build/consumer"), [], root);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-cpp-callback-results-installed:${installed.checks}\n`);
	const page = await readFile("docs/consume/cpp.md", "utf8");
	const example = page.match(/```cpp file=cpp\/owned-callback-results\.cpp\n([\s\S]*?)```/u)?.[1];
	assert.ok(example); await saveLakeFile(root, "documented.cpp", example);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], root,
		{ ...compileEnvironment, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
		, "documented.cpp", ...flags, "-o", "documented"], root, compileEnvironment);
	const documented = await runCopied(join(root, "documented"), [], root);
	assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "42\n");
	await saveLakeFile("build/owned-cpp-callback-results", `${mode}-${combined ? "combined" : "no-host"}-package.json`, canonicalJson({
		mode, combined, model, receipt, adapter, manifest, metadata
		, cli: candidate?.report ?? null, builds, packageSetReceipt: handoffReceipt
		, producerInterface: combined ? "installed-cli" : "native-build-api"
		, packages: built.packages, installed, rejected
		, tamperedSources: { generated: generatedSources, vendored: vendoredSources }
		, probeSha256: sha256(source), relocated: true
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, cliFilesVerified: candidate?.report.files.length ?? 0
		, independentRebuild: true, deterministicReassembly: true, cmake: true
		, documentation: { sourceSha256: sha256(example), stdout: documented.stdout }
	}));
	t.diagnostic(`${mode}: ${installed.checks} public C++ checks, ${rejected} forgeries rejected, deterministic original archives and relocated CMake pass`);
});

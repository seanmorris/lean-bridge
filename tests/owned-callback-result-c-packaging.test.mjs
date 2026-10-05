/**
 * Callback-local result lifetimes survive installed CLI builds and C relocation.
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
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed callback-result C archive (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-callback-result-installed-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(directory, "source");
	const output = join(directory, "producer"), handoff = join(directory, "handoff");
	const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "cli") });
	await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
	await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", candidate.archive], cwd: author });
	const cliRoot = join(author, "node_modules", candidate.report.package.name);
	for(const file of candidate.report.files)
	{
		const bytes = await readFile(join(cliRoot, file.path));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
	}
	await rm(candidate.output, { recursive: true });
	const cli = join(author, "node_modules/.bin/lean-bridge");
	await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedCallbackResultSource);
	const configuration = mode === "ordinary" ? await ownedCallbackResultConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { c: { name: "owned-callback-results", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedCallbackResultReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c"]), builds = [];
	for(const name of ["NODE_PATH", "NODE_OPTIONS"]) delete environment[name];
	const build = async destination => {
		t.diagnostic(`${mode}: installed CLI builds ${destination}`);
		const result = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, "--target", "c", "--output", destination, "--json"]
			, cwd: directory, env: environment, timeoutMs: 900000 })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.deepEqual(response.result.targets, ["c"]); builds.push(response);
		assert.deepEqual(await lakeInputState(project), before);
		return json(join(destination, "native-release.json"));
	};
	const built = await build(output); assert.equal(built.backend, "native-c-owned-v6");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const adapterRoot = join(output, "native/owned-c-binding");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
		, ownedInputTransfers: true
		, ownedAnchoredResults: true, ownedReceiverExports: true };
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, capabilities), { code: "native-owned-callback-anchors-unavailable" });
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedCallbackResultAnchors: true });
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const metadata = await json(join(nativeRoot, "metadata.json"));
	assert.equal(adapter.schemaVersion, 7); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.deepEqual(adapter.ownedValues.callbackResultAnchors, model.ownedGraph.callbackResultAnchors);
	const packageOptions = { adapterRoot, nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.c
		, glibcMinimumVersion: built.glibcMinimumVersion };
	await assert.rejects(packageOwnedNativeC({ ...packageOptions, target: "cpp", working: join(directory, "unsupported") }), /Owned C\+\+ adapter differs/u);
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
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(changed));
		await assert.rejects(packageOwnedNativeC({ ...packageOptions, working: join(directory, "forged") }), /compiler-authenticated/u);
		rejected++;
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of Object.keys(adapter.files).filter(path => path.startsWith("src/") || path.startsWith("include/")))
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
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	for(const path of [project, output, author])
	{
		await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" });
	}
	const source = await readFile("tests/fixtures/structured-types/owned-installed-callback-results.c", "utf8");
	const consumer = join(directory, "consumer"), installed = await installCopiedConsumer({
		profile: "c", consumer, handoff, environment
		, packages: handoffReceipt.packages
		, fixture: { source: () => source, success: "callback-results-installed"
			, expectedChecks: 134 } });
	const root = join(consumer, "c"), packageRoot = join(root, "owned-callback-results-1.2.3-c");
	const manifest = await json(join(packageRoot, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 7); assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
	assert.match(await readFile(join(packageRoot, "README.md"), "utf8"), /selected argument's original owner/u);
	await verifyNativeFiles(packageRoot, manifest.files);
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated"); await rename(packageRoot, relocated);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(CallbackResultConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnvironment = { ...copiedCleanEnvironment, PATH: join(root, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", root, "-B", "cmake-build"
		, "-G", "Unix Makefiles"
		, "-DCMAKE_C_COMPILER=/usr/bin/cc", "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], root, compileEnvironment);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], root, compileEnvironment);
	const cmake = await runCopied(join(root, "cmake-build/consumer"), [], root);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `callback-results-installed:${installed.checks}\n`);
	await saveLakeFile("build/owned-callback-results", `${mode}-c-package.json`, canonicalJson({
		mode, model, receipt, adapter, manifest, metadata
		, cli: candidate.report, builds, packageSetReceipt: handoffReceipt
		, packages: built.packages, installed, rejected
		, probeSha256: sha256(source), relocated: true
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, cliFilesVerified: candidate.report.files.length
		, independentRebuild: true, deterministicReassembly: true, cmake: true
	}));
	t.diagnostic(`${mode}: ${installed.checks} public C checks, ${rejected} forgeries rejected, deterministic original archives and relocated CMake pass`);
});

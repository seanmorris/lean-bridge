/**
 * Receiver packages built by an installed CLI and consumed without their source.
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
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr, ownedReceiverSource, ownedReceiverProbe, ownedReceiverCopyMacros } from "./helpers/owned-receiver-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed receiver C package survives relocation (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RECEIVER_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-receiver-package-${mode}-`));
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
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedReceiverSource);
	const configuration = mode === "ordinary" ? await ownedReceiverConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { c: { name: "owned-receivers", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedReceiverReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c"]);
	for(const name of ["NODE_PATH", "NODE_OPTIONS"]) delete environment[name];
	const builds = [];
	const build = async destination => {
		const result = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, "--target", "c", "--output", destination, "--json"]
			, cwd: directory, env: environment, timeoutMs: 900000 })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.deepEqual(response.result.targets, ["c"]); builds.push(response);
		assert.deepEqual(await lakeInputState(project), before);
		return json(join(destination, "native-release.json"));
	};
	const built = await build(output); assert.equal(built.backend, "native-c-owned-v5");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const adapterRoot = join(output, "native/owned-c-binding");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
		, ownedInputTransfers: true, ownedAnchoredResults: true };
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, identity, capabilities), { code: "native-owned-receivers-unavailable" });
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ...capabilities, ownedReceiverExports: true });
	assert.equal(model.schemaVersion, 10); assert.equal(receipt.schemaVersion, 6);
	assert.equal(model.ownedGraph.receiverExports.exports.length, 15);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const metadata = await json(join(nativeRoot, "metadata.json"));
	assert.equal(adapter.ownedValues.schemaVersion, 5);
	assert.deepEqual(adapter.ownedValues.receiverExports, model.ownedGraph.receiverExports);
	const reassembled = join(directory, "reassembled");
	const packageOptions = { adapterRoot, nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.c
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const rebuilt = await packageOwnedNativeC({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, built.packages);
	const archive = await readFile(join(output, "archives", built.packages[0].archive));
	assert.deepEqual(await readFile(join(reassembled, "archives", built.packages[0].archive)), archive);
	await rm(reassembled, { recursive: true });
	const independent = join(directory, "independent"), second = await build(independent);
	assert.deepEqual(second.packages, built.packages);
	assert.deepEqual(await readFile(join(independent, "archives", built.packages[0].archive)), archive);
	await rm(independent, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.receiverExports; }
		, value => { value.ownedValues.receiverExports.exports.pop(); }
		, value => { value.ownedValues.receiverExports.exports[0].argument = 1; }
		, value => { value.ownedValues.receiverExports.callingConvention = "receiver-last"; }
		, value => { value.ownedValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.ownedValues.receiverExports.exports[0].owner = "lean:Unknown"; }
		, value => { value.ownedValues.resultAnchors.lifetime = "parameter"; }
		, value => { value.ownedValues.resultAnchors.exports.find(item => item.receiver).receiver = false; }
		, value => { value.ownedValues.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket").parameter = 1; }
		, value => { value.schemaVersion = 5; value.ownedValues.schemaVersion = 4; }
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
		const changed = Buffer.concat([original, Buffer.from("\n/* changed generated source */\n")]);
		const forged = structuredClone(adapter); forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNativeC({ ...packageOptions, working: join(directory, "forged") }), /generated source differs/u);
		rejected++;
		await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const values = generateOwnedCValues(model.bindingIr, { hostCallbacks: true, anchoredResults: true, transferredInputs: true, receiverExports: true });
	const source = "#define LEAN_BRIDGE_BORROW_INSTALLED 1\n" + (await ownedReceiverProbe()).replace('#include "borrow-copies.h"', ownedReceiverCopyMacros(values));
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	for(const path of [project, output]) await assert.rejects(access(path), { code: "ENOENT" });
	const verification = JSON.parse((await runCopied(process.execPath, [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], directory)).stdout);
	assert.equal(verification.status, "ok");
	assert.equal(verification.result.verificationType, "local-package-set");
	await rm(author, { recursive: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	const consumer = join(directory, "consumer");
	const installed = await installCopiedConsumer({
		profile: "c", consumer, handoff, environment
		, packages: handoffReceipt.packages
		, fixture: { source: () => source, success: "owned-borrows-installed" } });
	assert.ok(installed.checks > 500);
	const root = join(consumer, "c"), packageRoot = join(root, "owned-receivers-1.2.3-c");
	const manifest = await json(join(packageRoot, "lean-bridge-package.json"));
	assert.equal(manifest.schemaVersion, 6);
	assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
	assert.match(await readFile(join(packageRoot, "README.md"), "utf8"), /Methods and properties take their receiver as the first argument/u);
	await verifyNativeFiles(packageRoot, manifest.files);
	await rm(handoff, { recursive: true });
	const relocated = join(directory, "relocated"); await rename(packageRoot, relocated);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(ReceiverConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnvironment = { ...copiedCleanEnvironment, PATH: join(root, "tools") };
	await runCopied("/usr/bin/cmake", [
		"-S", root, "-B", "cmake-build", "-G", "Unix Makefiles"
		, "-DCMAKE_C_COMPILER=/usr/bin/cc", "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`
	], root, compileEnvironment);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], root, compileEnvironment);
	const cmake = await runCopied(join(root, "cmake-build/consumer"), [], root);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-borrows-installed:${installed.checks}\n`);
	const page = await readFile("docs/consume/c.md", "utf8");
	const example = page.split("### Methods and properties\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example); await saveLakeFile(root, "receiver.c", example);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], root,
		{ ...compileEnvironment, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "receiver.c", ...flags, "-o", "receiver"], root, compileEnvironment);
	const documented = await runCopied(join(root, "receiver"), [], root);
	assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "42\nreceiver released: view expired\n");
	await saveLakeFile("build/owned-receivers", mode + "-package.json", canonicalJson({
		mode, model, receipt, adapter, manifest, metadata
		, cli: candidate.report, builds, verification, packages: built.packages
		, cliInstallation: { offline: true, filesVerified: candidate.report.files.length, sourceRemoved: true }
		, installed, rejected, probeSha256: sha256(source), relocated: true
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, documentation: { sourceSha256: sha256(example), stdout: documented.stdout }
		, independentRebuild: true, deterministicReassembly: true, cmake: true }));
	t.diagnostic(`${mode}: ${installed.checks} installed receiver assertions, original archives reproduced, relocated CMake passed`);
});

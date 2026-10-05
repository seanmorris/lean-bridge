/**
 * Receiver WIT archives install without Lean or their producer tree.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { readVerifiedOwnedWitHost } from "../src/build/owned-wit-artifacts.mjs";
import { packageOwnedWasi } from "../src/release/owned-wasi.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedWitReceiverConfiguration } from "./helpers/wit-owned-receiver-configurations.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedWitInstalledDependencies } from "./helpers/wit-owned-package-loader.mjs";
import { ownedWitReceiverResourceProbe } from "./helpers/wit-owned-receiver-resource-probe.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) for(const kind of ["plain", "consuming", "unanchored"]) test(`installed WIT receiver optional capabilities (${mode}, ${kind})`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_RECEIVER_TEST !== "1", timeout: 3600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-wit-receivers-${mode}-${kind}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	const author = join(directory, "author");
	const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "cli-candidate") });
	await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
	await processBuildRunner.capture({ command: "npm"
		, args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", candidate.archive]
		, cwd: author });
	const cliRoot = join(author, "node_modules", candidate.report.package.name);
	const cli = join(author, "node_modules/.bin/lean-bridge");
	for(const item of candidate.report.files)
	{
		const bytes = await readFile(join(cliRoot, item.path));
		assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
	}
	await rm(candidate.output, { recursive: true });
	await assert.rejects(access(candidate.output), { code: "ENOENT" });
	const installedCli = { report: candidate.report, offlineInstall: true
		, filesVerified: candidate.report.files.length
		, packagingSourceRemoved: true };
	const selected = await ownedWitReceiverConfiguration(kind);
	await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + selected.sourceSuffix);
	const settings = { name: "owned-receivers", version: "1.2.3" };
	const config = mode === "ordinary" ? selected.configuration : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { "wit-wasi": settings };
	if(mode === "reviewed") config.targets.c = settings;
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(selected.reviewedIr));
	const environment = nativeFixtureEnvironment(["wit-wasi"]), before = await lakeInputState(project);
	for(const key of ["NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
	const targets = Object.keys(config.targets), cliBuilds = [];
	const build = async destination => {
		const invocation = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, "--output", destination
				, ...targets.flatMap(target => ["--target", target]), "--json"]
			, cwd: directory, env: environment, timeoutMs: 1200000 })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const response = JSON.parse(invocation.stdout); assert.equal(response.status, "ok");
		assert.deepEqual(response.result.targets, [...targets].sort());
		cliBuilds.push(response);
		return json(join(destination, "native-release.json"));
	};
	const built = await build(output);
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "wit-wasi") ?? built;
	assert.equal(projection.ecosystem, "wit-wasi");
	const witRoot = join(output, "native/owned-wit-adapter");
	const options = { witRoot, nativeRoot: join(output, "native/component")
		, runtimeRoot: join(output, "native/runtime"), settings
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const verified = await readVerifiedOwnedWitHost(options), { model, compiled, generated } = verified;
	const component = await readFile(join(witRoot, compiled.component));
	assert.equal(model.schemaVersion, 10);
	assert.equal(model.exports.length, kind === "unanchored" ? 27 : kind === "consuming" ? 5 : 4);
	assert.equal(compiled.ownedValues.schemaVersion, 4);
	assert.deepEqual(compiled.ownedValues.receiverExports, model.ownedGraph.receiverExports);
	assert.equal(model.ownedGraph.receiverExports.exports.length, kind === "unanchored" ? 16 : kind === "consuming" ? 4 : 3);
	assert.deepEqual(compiled.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
	assert.deepEqual(compiled.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
	assert.equal(Boolean(model.ownedGraph.inputTransfers), selected.transferredInputs);
	// The native CLI enables callback admission, even for zero-signature APIs.
	assert.equal(model.ownedGraph.hostCallbacks.signatures.length > 0, selected.hostCallbacks);
	assert.equal(generated.values.callbacks.length > 0, selected.hostCallbacks);
	assert.equal(model.ownedGraph.resultAnchors, undefined);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	await assert.rejects(readVerifiedNativeComponent(options.nativeRoot, verified.runtimeIdentity, {
		ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true
	}), /receiver/u);
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedWasi({ ...options, working: reassembled });
	const packages = built.packages.filter(item => item.archive.endsWith("-wit-wasi.tar.gz"));
	assert.equal(packages.length, 1); assert.deepEqual(rebuilt.packages, packages);
	const originalArchive = await readFile(join(output, "archives", packages[0].archive));
	assert.deepEqual(await readFile(join(reassembled, "archives", packages[0].archive)), originalArchive);
	await rm(reassembled, { recursive: true });
	const independent = join(directory, "independent");
	const second = await build(independent);
	assert.deepEqual(second.packages, built.packages);
	assert.deepEqual(await readFile(join(independent, "archives", packages[0].archive)), originalArchive);
	await rm(independent, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { value.ownedValues.schemaVersion = 3; }
		, value => { delete value.ownedValues.receiverExports; }
		, value => { value.ownedValues.receiverExports.exports.pop(); }
		, value => { value.ownedValues.receiverExports.exports[0].argument = 1; }
		, value => { value.ownedValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.ownedValues.receiverExports.callingConvention = "receiver-last"; }
		, value => { value.ownedValues.resultAnchors = {}; }
		, value => { value.ownedValues.hostCallbacks = false; }
		, value => { value.ownedValues.inputTransfers = {}; }
	]) {
		const changed = structuredClone(compiled); mutate(changed);
		await saveLakeFile(witRoot, "native-wit-adapter.json", canonicalJson(changed));
		await assert.rejects(readVerifiedOwnedWitHost(options), /compiler-authenticated/u); rejected++;
	}
	await saveLakeFile(witRoot, "native-wit-adapter.json", canonicalJson(compiled));
	for(const path of Object.keys(verified.files))
	{
		const original = await readFile(join(witRoot, path)), changed = Buffer.concat([original, Buffer.from("\n/* altered source */\n")]);
		const record = structuredClone(compiled); record.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(witRoot, path, changed); await saveLakeFile(witRoot, "native-wit-adapter.json", canonicalJson(record));
		await assert.rejects(readVerifiedOwnedWitHost(options), undefined, path); rejected++;
		await saveLakeFile(witRoot, path, original); await saveLakeFile(witRoot, "native-wit-adapter.json", canonicalJson(compiled));
	}
	const source = await ownedWitReceiverResourceProbe(generated, kind, true);
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const cliVerification = JSON.parse((await runCopied(process.execPath
		, [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], directory)).stdout);
	assert.equal(cliVerification.status, "ok");
	assert.equal(cliVerification.result.verificationType, "local-package-set");
	await rm(author, { recursive: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	const observed = await installCopiedConsumer({ profile: "wit-wasi"
		, consumer, handoff, environment
		, packages: receipt.packages.filter(item => item.target === "wit-wasi")
		, fixture: { source: () => source, success: "owned-receivers-installed"
			, expectedChecks: kind === "unanchored" ? 74 : kind === "consuming" ? 30 : 21
			, wit: [/resource identity-ticket/u, /borrow<identity-ticket>/u] } });
	assert.equal(observed.checks, kind === "unanchored" ? 74 : kind === "consuming" ? 30 : 21);
	const root = join(consumer, "wit-wasi"), installed = join(root, "owned-receivers-1.2.3-wit-wasi");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	await verifyNativeFiles(installed, manifest.files);
	assert.deepEqual(manifest.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
	assert.match(await readFile(join(installed, "README.md"), "utf8"), /Methods and properties/u);
	await rm(handoff, { recursive: true });
	const relocated = join(directory, "relocated"); await rename(installed, relocated);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(WitReceivers C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnv = { ...copiedCleanEnvironment, PATH: join(root, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", root, "-B", "cmake-build"
		, "-G", "Unix Makefiles", "-DCMAKE_C_COMPILER=/usr/bin/cc"
		, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], root, compileEnv);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], root, compileEnv);
	const cmake = await runCopied(join(root, "cmake-build/consumer"), [], root);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-receivers-installed:${observed.checks}\n`);
	const loader = await checkOwnedWitInstalledDependencies({ root, installed: relocated, environment: compileEnv, manifest });

	await saveLakeFile("build/owned-wit-receivers", `${mode}-${kind}-package.json`, canonicalJson({
		schemaVersion: 1, mode, kind, model, receipt: compiled, manifest
		, packages: built.packages, sourceRemovedBeforeInstall: true
		, relocated: true, deterministicReassembly: true, independentRebuild: true
		, installed: observed, pkgConfig: true, cmake: true, loader, rejected
		, targets, probeSha256: sha256(source)
		, installedCli, cliBuilds, cliVerification
		, cliRemovedBeforeConsumerInstall: true
		, inputs: verified.inputs, componentBase64: component.toString("base64")
	}));
	t.diagnostic(`${mode}, ${kind}: ${observed.checks} installed checks, ${rejected} rejected mutations, pkg-config and relocated CMake passed`);
});

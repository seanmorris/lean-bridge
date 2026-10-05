/**
 * Original-owner WIT archives install without Lean or their producer tree.
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
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedWitInstalledDependencies } from "./helpers/wit-owned-package-loader.mjs";
import { ownedWitBorrowProbe } from "./helpers/wit-owned-borrow-probe.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed ${mode} WIT borrowed results survive source removal and relocation`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_BORROW_TEST !== "1", timeout: 3600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-wit-borrows-${mode}-`));
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
	await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedRustBorrowSource);
	const settings = { name: "owned-borrows", version: "1.2.3" };
	const config = mode === "ordinary" ? await ownedRustBorrowConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { "wit-wasi": settings };
	if(mode === "reviewed") config.targets.c = settings;
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
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
	assert.equal(model.schemaVersion, 9); assert.equal(model.exports.length, 26);
	assert.equal(compiled.ownedValues.schemaVersion, 3);
	assert.deepEqual(compiled.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
	assert.deepEqual(compiled.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
	assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	await assert.rejects(readVerifiedNativeComponent(options.nativeRoot, verified.runtimeIdentity, {
		ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true
	}), /anchor/u);
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
		value => { value.ownedValues.schemaVersion = 2; }
		, value => { delete value.ownedValues.resultAnchors; }
		, value => { value.ownedValues.resultAnchors.exports.pop(); }
		, value => { value.ownedValues.resultAnchors.exports[0].parameter = 99; }
		, value => { delete value.ownedValues.inputTransfers; }
		, value => { value.ownedValues.inputTransfers.consumption = "after-lean-call"; }
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
	const macros = [
		["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
		, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
		, ["ROW", "echoRow"], ["NESTED", "echoNested"]
	].map(([macro, name]) => {
		const id = generated.values.functions.find(fn => fn.name === name).parameters[0];
		return `#define COPY_${macro} ${generated.values.copies.find(fn => fn.id === id).cName}\n`;
	}).join("");
	const source = (await ownedWitBorrowProbe(generated, true)).replace('#include "borrow-copies.h"', macros);
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
		, fixture: { source: () => source, success: "owned-borrows-installed"
			, wit: [/resource identity-ticket/u, /borrow<identity-ticket>/u] } });
	assert.ok(observed.checks > 500);
	const root = join(consumer, "wit-wasi"), installed = join(root, "owned-borrows-1.2.3-wit-wasi");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	await verifyNativeFiles(installed, manifest.files);
	assert.deepEqual(manifest.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
	assert.match(await readFile(join(installed, "README.md"), "utf8"), /original native lifetime anchor/u);
	await rm(handoff, { recursive: true });
	const relocated = join(directory, "relocated"); await rename(installed, relocated);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(WitBorrows C)
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
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-borrows-installed:${observed.checks}\n`);
	const loader = await checkOwnedWitInstalledDependencies({ root, installed: relocated, environment: compileEnv, manifest });
	const page = await readFile("docs/consume/wit-wasi.md", "utf8");
	const documented = page.split("### Borrowed results\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(documented, "Missing executable WIT borrowed-result example");
	await saveLakeFile(root, "documented.c", documented);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], root,
		{ ...compileEnv, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "documented.c", ...flags, "-o", "documented"], root, compileEnv);
	const example = await runCopied(join(root, "documented"), [], root);
	assert.equal(example.stderr, ""); assert.equal(example.stdout, "42\nexpired\n42\n");
	await saveLakeFile("build/owned-wit-borrows", mode + "-package.json", canonicalJson({
		schemaVersion: 1, mode, model, receipt: compiled, manifest
		, packages: built.packages, sourceRemovedBeforeInstall: true
		, relocated: true, deterministicReassembly: true, independentRebuild: true
		, installed: observed, pkgConfig: true, cmake: true, loader, rejected
		, targets, probeSha256: sha256(source)
		, installedCli, cliBuilds, cliVerification
		, cliRemovedBeforeConsumerInstall: true
		, documentation: { sourceSha256: sha256(documented), stdout: example.stdout }
		, inputs: verified.inputs, componentBase64: component.toString("base64")
	}));
	t.diagnostic(`${mode}: ${observed.checks} installed checks, ${rejected} rejected mutations, pkg-config and relocated CMake passed`);
});

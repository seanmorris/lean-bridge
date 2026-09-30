/**
 * Consuming WIT archives install offline after deleting their producer trees.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { readVerifiedOwnedWitHost } from "../src/build/owned-wit-artifacts.mjs";
import { packageOwnedWasi } from "../src/release/owned-wasi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedWitInstalledDependencies } from "./helpers/wit-owned-package-loader.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed ${mode} WIT transfers survive source removal and relocation`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_TRANSFER_TEST !== "1", timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-wit-transfers-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedRustTransferSource);
	const settings = { name: "owned-transfers", version: "1.2.3" };
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { "wit-wasi": settings };
	if(mode === "reviewed") config.targets.c = settings;
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const environment = nativeFixtureEnvironment(["wit-wasi"]), before = await lakeInputState(project);
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "wit-wasi") ?? built;
	assert.equal(projection.ecosystem, "wit-wasi");
	const witRoot = join(output, "native/owned-wit-adapter");
	const options = { witRoot, nativeRoot: join(output, "native/component")
		, runtimeRoot: join(output, "native/runtime"), settings
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const verified = await readVerifiedOwnedWitHost(options), { model, compiled, prefix, generated } = verified;
	const component = await readFile(join(witRoot, compiled.component));
	assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
	assert.equal(compiled.ownedValues.schemaVersion, 2);
	assert.deepEqual(compiled.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
	assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedWasi({ ...options, working: reassembled });
	const packages = built.packages.filter(item => item.archive.endsWith("-wit-wasi.tar.gz"));
	assert.equal(packages.length, 1);
	assert.deepEqual(rebuilt.packages, packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", packages[0].archive)), await readFile(join(output, "archives", packages[0].archive)));
	await rm(reassembled, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.inputTransfers; }
		, value => { value.ownedValues.inputTransfers.exports.pop(); }
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
		, ["ROW", "echoRow"], ["NESTED", "echoNested"]]
		.map(([macro, name]) => {
			const id = generated.values.functions.find(fn => fn.name === name).parameters[0];
			return `#define COPY_${macro} ${generated.values.copies.find(fn => fn.id === id).cName}\n`;
		}).join("");
	const mixed = await readFile("tests/fixtures/structured-types/owned-installed-wit-transfer-mixed.c", "utf8");
	const source = macros + (await readFile("tests/fixtures/structured-types/owned-installed-transfers.c", "utf8"))
		.replace("int main(void) {", mixed + "\nint main(void) {")
		.replace("invalid_and_affinity();", "invalid_and_affinity(); mixed_values();")
		.replaceAll("owned_aggregates_echo_tuple_argument0_snd_t", "owned_aggregates_mixed_product_snd_t")
		.replaceAll("owned_aggregates", prefix).replaceAll("OWNED_AGGREGATES", prefix.toUpperCase());
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observed = await installCopiedConsumer({ profile: "wit-wasi"
		, consumer, handoff, environment
		, packages: receipt.packages.filter(item => item.target === "wit-wasi")
		, fixture: { source: () => source, success: "owned-transfers-installed"
			, wit: [/resource identity-ticket/u, /borrow<identity-ticket>/u, /retain-ticket: func\([^;]+identity-ticket[^;]+ -> identity-ticket;/u] } });
	assert.ok(observed.checks > 500);
	const root = join(consumer, "wit-wasi"), installed = join(root, "owned-transfers-1.2.3-wit-wasi");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	await verifyNativeFiles(installed, manifest.files);
	assert.deepEqual(manifest.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
	assert.match(await readFile(join(installed, "README.md"), "utf8"), /NULL before Lean runs/u);
	await rm(handoff, { recursive: true });
	const relocated = join(directory, "relocated"); await rename(installed, relocated);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(WitTransfers C)
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
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-transfers-installed:${observed.checks}\n`);
	const loader = await checkOwnedWitInstalledDependencies({ root, installed: relocated, environment: compileEnv, manifest });
	const page = await readFile("docs/consume/wit-wasi.md", "utf8");
	const documented = page.split("### Consuming inputs\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(documented, "Missing executable WIT input transfer example");
	await saveLakeFile(root, "documented.c", documented);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], root,
		{ ...compileEnv, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "documented.c", ...flags, "-o", "documented"], root, compileEnv);
	const example = await runCopied(join(root, "documented"), [], root);
	assert.equal(example.stderr, ""); assert.equal(example.stdout, "42\n");
	await saveLakeFile("build/owned-wit-transfers", mode + "-package.json", canonicalJson({
		schemaVersion: 1, mode, model, receipt: compiled, manifest
		, packages: built.packages, sourceRemovedBeforeInstall: true
		, relocated: true, deterministicReassembly: true
		, installed: observed, pkgConfig: true, cmake: true, loader, rejected
		, targets: Object.keys(config.targets)
		, documentation: { sourceSha256: sha256(documented), stdout: example.stdout }
		, inputs: verified.inputs, componentBase64: component.toString("base64")
	}));
	t.diagnostic(`${mode}: ${observed.checks} installed checks, ${rejected} rejected mutations, pkg-config and relocated CMake passed`);
});

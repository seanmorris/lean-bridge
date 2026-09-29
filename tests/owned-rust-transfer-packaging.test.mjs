/**
 * Compiler-authenticated Rust transfers in source-free installed Cargo packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedRustPackage } from "../src/backends/rust/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedRustEvidence } from "../src/build/owned-rust-artifacts.mjs";
import { projectOwnedNativeCFamily } from "../src/build/owned-c-projection.mjs";
import { packageOwnedCargo } from "../src/release/owned-cargo.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
test("Cargo transfers bind explicit consumption without changing borrow-only packages", () => {
	const generated = generateOwnedRustPackage(ownedRustTransferReviewedIr(), null, {}, { transferredInputs: true });
	assert.equal(generated.contract.schemaVersion, 2);
	assert.equal(generated.contract.inputTransfers.arguments, "mutable-references");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-rust-v2");
	assert.throws(() => generateOwnedRustPackage(ownedRustTransferReviewedIr()), /call-scoped input borrows/u);
	assert.deepEqual(generateOwnedRustPackage(ownedCppCompositionReviewedIr(), null, {}, { transferredInputs: true }).files,
		generateOwnedRustPackage(ownedCppCompositionReviewedIr()).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Cargo inputs preserve transfer decisions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_TRANSFER_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-rust-transfers-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer"), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustTransferSource);
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { cargo: { name: "owned-transfers", version: "1.2.3" }
		, c: { name: "owned-c-transfers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-transfers", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const before = await lakeInputState(project), environment = { ...nativeFixtureEnvironment(["rust"]), CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	let built;
	try
	{ built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output
		, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) }); }
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections.find(item => item.ecosystem === "cargo");
	assert.equal(projection.backend, "owned-rust-v2");
	assert.deepEqual(built.projections.map(item => item.ecosystem).sort(), ["c", "cargo", "cpp"]);
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding"), rustRoot = join(output, "native/rust");
	const verified = await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot }), compiled = await json(join(rustRoot, "native-rust.json"));
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	assert.equal(verified.model.exports.length, 26); assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(compiled.schemaVersion, 3); assert.equal(verified.adapter.schemaVersion, 4);
	assert.equal(compiled.ownedValues.inputTransfers.consumption, "before-lean-call");
	const options = { rustRoot, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.cargo
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	for(const mutation of ["compiled-version", "adapter-version", "compiled-consumption", "adapter-aliases"])
	{
		const forged = structuredClone(compiled), adapter = structuredClone(verified.adapter);
		if(mutation === "compiled-version") forged.schemaVersion = 2;
		if(mutation === "adapter-version") adapter.schemaVersion = 3;
		if(mutation === "compiled-consumption") forged.ownedValues.inputTransfers.consumption = "after-lean-call";
		if(mutation === "adapter-aliases") adapter.rustValues.inputTransfers.aliases = "wrapper-only";
		await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(forged));
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
		await assert.rejects(packageOwnedCargo({ ...options, working: join(directory, `forged-${mutation}`) }), /compiler-authenticated/u);
		await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(compiled));
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(verified.adapter));
	}
	await assert.rejects(projectOwnedNativeCFamily({
		working: join(directory, "unsupported-python"), nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, targets: ["pypi"], environment })
	, /requires an owned input-transfer consumer adapter/u);
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedCargo({ ...options, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = await prepareRustCorpusDependencies({ rustRoot, directory, handoff, environment });
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const cpp = await installCopiedConsumer({ profile: "cpp", consumer, handoff
		, environment
		, packages: receipt.packages.filter(item => item.target === "cpp")
		, fixture: { source: async () => "#define OWNED_TRANSFER_INSTALLED 1\n" + await readFile("tests/fixtures/structured-types/owned-cpp-transfers.cpp", "utf8")
			, success: "owned-cpp-transfers-installed" } });
	assert.ok(cpp.checks > 100);
	const pkg = receipt.packages.find(item => item.target === "cargo" && item.role === "component");
	const tools = join(consumer, "tools"), cargoHome = join(consumer, "cargo-home"); await mkdir(tools, { recursive: true }); await mkdir(cargoHome);
	await symlink("/usr/bin/ld", join(tools, "ld")); await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	assert.deepEqual(await readdir(cargoHome), []);
	const env = { ...copiedCleanEnvironment, PATH: tools
		, RUSTC: environment.LEAN_BRIDGE_RUSTC, RUSTFLAGS: "-Dwarnings"
		, CARGO_HOME: cargoHome, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
		, CARGO_TARGET_DIR: join(consumer, "target")
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	for(const file of [pkg.artifacts[0].path, dependencies.archive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, file)], consumer);
	const installed = join(consumer, `${pkg.name}-${pkg.version}`), manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 3); await verifyNativeFiles(installed, manifest.files);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	await saveLakeFile(consumer, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
	await saveLakeFile(consumer, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = "use owned_transfers::*;\n" + await readFile("tests/fixtures/structured-types/owned-rust-transfers.rs", "utf8");
	await saveLakeFile(consumer, "consumer.rs", source);
	const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, consumer, env);
	await cargo(["generate-lockfile", "--offline"]); await cargo(["build", "--offline", "--locked", "--bin", "consumer"]);
	const command = join(consumer, "target/debug/consumer"), executed = await runCopied(command, [], consumer);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^owned-rust-transfers-installed:\d+\n$/u);
	const checks = Number(executed.stdout.trim().split(":")[1]); assert.ok(checks > 130);
	const documented = await readFile("tests/fixtures/documentation/consumers/rust/owned-transfers.rs", "utf8");
	await saveLakeFile(consumer, "src/bin/documentation.rs", documented);
	await cargo(["build", "--offline", "--locked", "--bin", "documentation"]);
	const example = await runCopied(join(consumer, "target/debug/documentation"), [], consumer);
	assert.equal(example.stderr, ""); assert.equal(example.stdout, "transferred\n");
	const relocated = join(directory, "relocated"); await mkdir(relocated); const relocatedCommand = join(relocated, "consumer"); await rename(command, relocatedCommand);
	await rm(consumer, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(installed), { code: "ENOENT" }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const moved = await runCopied(relocatedCommand, [], relocated, { ...copiedCleanEnvironment, RUSTC: "/unavailable", CARGO_HOME: "/unavailable" });
	assert.deepEqual(moved.stdout, executed.stdout); assert.equal(moved.stderr, "");
	await saveLakeFile(resolve("build/owned-rust-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true
		, sourceUnchanged: true, sourceFreeInstallation: true
		, emptyCargoHome: true, offlineInstall: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true
		, tamperRejected: ["compiled-version", "adapter-version", "compiled-consumption", "adapter-aliases"]
		, unsupportedPythonRejected: true
		, documentationSha256: sha256(documented), cppChecks: cpp.checks
		, checks, relocatedChecks: checks, consumerSha256: sha256(source)
		, linkerSha256: sha256(linker), dependencies
		, input, componentReceipt: verified.receipt
		, adapterReceipt: verified.adapter, compiledReceipt: compiled
		, packageSetReceipt: receipt, manifest
	}));
	t.diagnostic(`${mode}: ${checks} installed checks and ${checks} source-free relocated checks`);
});

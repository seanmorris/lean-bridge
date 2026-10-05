/**
 * Compiler-authenticated original-owner borrows in source-free Cargo consumers.
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
import { packageOwnedCargo } from "../src/release/owned-cargo.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowConfiguration, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
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
test("Cargo borrows authenticate whole owners without changing unanchored packages", () => {
	const generated = generateOwnedRustPackage(ownedRustBorrowReviewedIr(), null, {}, { transferredInputs: true, anchoredResults: true });
	assert.equal(generated.contract.schemaVersion, 3);
	assert.equal(generated.contract.resultAnchors.anchor, "original-result-owner");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-rust-v3");
	assert.throws(() => generateOwnedRustPackage(ownedRustBorrowReviewedIr(), null, {}, { transferredInputs: true }), /explicit output leases/u);
	assert.deepEqual(generateOwnedRustPackage(ownedAggregateReviewedIr(), null, {}, { anchoredResults: true }).files,
		generateOwnedRustPackage(ownedAggregateReviewedIr()).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Cargo borrowed results preserve original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_BORROW_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-rust-borrows-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustBorrowSource);
	const config = mode === "ordinary" ? await ownedRustBorrowConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { cargo: { name: "owned-borrows", version: "1.2.3" }
		, c: { name: "owned-c-borrows", version: "1.2.3" }
		, cpp: { name: "owned-cpp-borrows", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment(["rust"]), CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output
		, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections.find(item => item.ecosystem === "cargo");
	assert.equal(projection.backend, "owned-rust-v3");
	assert.deepEqual(built.projections.map(item => item.ecosystem).sort(), ["c", "cargo", "cpp"]);
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-c-binding"), rustRoot = join(output, "native/rust");
	const verified = await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const compiled = await json(join(rustRoot, "native-rust.json"));
	const input = { metadata: await json(join(nativeRoot, "metadata.json"))
		, sourceIdentity: verified.model.sourceIdentity
		, component: verified.model.component };
	assert.equal(verified.model.schemaVersion, 9); assert.equal(verified.model.exports.length, 26);
	assert.equal(verified.model.ownedGraph.resultAnchors.exports.length, 19);
	assert.equal(verified.model.ownedGraph.inputTransfers.exports.length, 4);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(compiled.schemaVersion, 4); assert.equal(verified.adapter.schemaVersion, 5);
	const options = { rustRoot, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.cargo
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const fields = ["values", "anchor", "expiration", "descendants", "emptyValues"
		, "aliases", "independentOwnership", "resourceEquality", "invalidEquality"
		, "fallibleEquality", "transfers"];
	for(const field of fields)
	{
		const adapter = structuredClone(verified.adapter); adapter.rustValues.resultAnchors[field] = "forged";
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
		await assert.rejects(packageOwnedCargo({ ...options, working: join(directory, `forged-${field}`) }), /compiler-authenticated/u);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(verified.adapter));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true };
	for(const key of ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults"])
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedCargo({ ...options, working: reassembled });
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
		, fixture: { source: async () => "#define OWNED_BORROW_INSTALLED 1\n" + await readFile("tests/fixtures/structured-types/owned-cpp-borrows.cpp", "utf8")
			, success: "owned-cpp-borrows-installed" } });
	assert.equal(cpp.checks, 407);
	const pkg = receipt.packages.find(item => item.target === "cargo" && item.role === "component");
	const tools = join(consumer, "tools"), cargoHome = join(consumer, "cargo-home");
	await mkdir(tools, { recursive: true }); await mkdir(cargoHome);
	await symlink("/usr/bin/ld", join(tools, "ld")); await saveLakeFile(tools, "link-only", linker);
	await chmod(join(tools, "link-only"), 0o755); assert.deepEqual(await readdir(cargoHome), []);
	const env = { ...copiedCleanEnvironment, PATH: tools
		, RUSTC: environment.LEAN_BRIDGE_RUSTC, RUSTFLAGS: "-Dwarnings"
		, CARGO_HOME: cargoHome, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
		, CARGO_TARGET_DIR: join(consumer, "target")
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	for(const file of [pkg.artifacts[0].path, dependencies.archive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, file)], consumer);
	const installed = join(consumer, `${pkg.name}-${pkg.version}`);
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 4); await verifyNativeFiles(installed, manifest.files);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	await saveLakeFile(consumer, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
	await saveLakeFile(consumer, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = "use owned_borrows::*;\n" + await readFile("tests/fixtures/structured-types/owned-rust-borrows.rs", "utf8");
	await saveLakeFile(consumer, "consumer.rs", source);
	const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, consumer, env);
	await cargo(["generate-lockfile", "--offline"]); await cargo(["build", "--offline", "--locked", "--bin", "consumer"]);
	const command = join(consumer, "target/debug/consumer"), executed = await runCopied(command, [], consumer);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^owned-rust-borrows:\d+\n$/u);
	const checks = Number(executed.stdout.trim().split(":")[1]); assert.ok(checks > 300);
	const documented = await readFile("tests/fixtures/documentation/consumers/rust/owned-borrows.rs", "utf8");
	assert.equal((await readFile("docs/consume/rust.md", "utf8")).match(/```rust file=rust\/owned-borrows\.rs\n([\s\S]*?)```/u)?.[1], documented);
	await saveLakeFile(consumer, "src/bin/documentation.rs", documented);
	await cargo(["build", "--offline", "--locked", "--bin", "documentation"]);
	const example = await runCopied(join(consumer, "target/debug/documentation"), [], consumer);
	assert.equal(example.stderr, ""); assert.equal(example.stdout, "42\n");
	const relocated = join(directory, "relocated"); await mkdir(relocated);
	const relocatedCommand = join(relocated, "consumer"); await rename(command, relocatedCommand);
	await rm(consumer, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(installed), { code: "ENOENT" }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const moved = await runCopied(relocatedCommand, [], relocated, { ...copiedCleanEnvironment, RUSTC: "/unavailable", CARGO_HOME: "/unavailable" });
	assert.deepEqual(moved.stdout, executed.stdout); assert.equal(moved.stderr, "");
	await saveLakeFile(resolve("build/owned-rust-borrow-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true
		, sourceUnchanged: true, sourceFreeInstallation: true, emptyCargoHome: true
		, offlineInstall: true, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, forgedAnchorContractsRejected: fields, incapableReadersRejected: 3
		, documentation: { sourceSha256: sha256(documented), stdout: example.stdout }
		, cppChecks: cpp.checks, checks, relocatedChecks: checks
		, consumerSha256: sha256(source), linkerSha256: sha256(linker), dependencies
		, input, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, compiledReceipt: compiled, packageSetReceipt: receipt, manifest
	}));
	t.diagnostic(`${mode}: ${checks} installed Rust checks, relocated execution, ${cpp.checks} shared C++ checks`);
});

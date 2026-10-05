/**
 * Install prepared owned-value Cargo archives without Lean or native compilation.
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
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const enabled = process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST === "1";
const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;

test("prepared owned Rust sources bind deterministic APIs and automatic loading", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir);
	const generated = generateOwnedRustPackage(ir); assert.deepEqual(ir, before);
	assert.deepEqual(generateOwnedRustPackage(ir).files, generated.files);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateOwnedRustPackage(reversed);
	// Declaration reordering preserves code; receipts still bind the exact IR.
	for(const [path, source] of Object.entries(generated.files))
		if(path !== "binding-manifest.json") assert.equal(reordered.files[path], source);
	assert.deepEqual(reordered.contract, generated.contract);
	assert.equal(JSON.parse(reordered.files["binding-manifest.json"]).bindingIrSha256, reordered.c.native.model.bindingIrSha256);
	assert.equal(generated.contract.loader, "authenticated-embedded-native");
	assert.match(generated.files["src/lib.rs"], /owned_native_api\(\)\?/u);
	assert.doesNotMatch(generated.files["src/lib.rs"], /link_name = "owned_aggregates/u);
	assert.doesNotMatch(generated.files["src/owned_values.rs"], /link_name = "owned_aggregates/u);
	assert.match(generated.files["src/owned_values.rs"], /assets::load\(\)\?/u);
	assert.match(generated.abiHeader, /GMP_NUMB_BITS == 64/u);
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).contract.abiHeaderSha256, sha256(generated.abiHeader));
});

test("owned Rust inspection crate compiles without native linker configuration", { skip: !enabled, timeout: 180000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-rust-inspect-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedRustPackage(ownedCppCompositionReviewedIr(), null, { name: "owned-values", version: "1.2.3" });
	for(const [path, source] of Object.entries(generated.files)) await saveLakeFile(directory, path, source);
	await saveLakeFile(directory, "src/bin/inspect.rs", `use owned_values::*;
fn main() {
    match new_ticket(&BigUint::from(1u32), "test") {
        Err(Error::Load(message)) => assert!(message.contains("Build a compiled Cargo release")),
        other => panic!("unexpected inspection result: {other:?}"),
    }
}
`);
	const environment = nativeFixtureEnvironment(["rust"]);
	const env = { PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true"
		, CARGO_INCREMENTAL: "0", RUSTFLAGS: "-Dwarnings" };
	await runCopied(environment.LEAN_BRIDGE_CARGO, ["run", "--offline", "--bin", "inspect"], directory, env);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Rust owned compositions preserve semantics (${mode})`, { skip: !enabled, timeout: 1200000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-rust-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer"), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-cpp-composition"), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { cargo: { name: "owned-values", version: "1.2.3" } };
	if(mode === "reviewed") Object.assign(config.targets, { c: { name: "owned-c-values", version: "1.2.3" }, cpp: { name: "owned-cpp-values", version: "1.2.3" } });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedCppCompositionReviewedIr()));
	const before = await lakeInputState(project), environment = { ...nativeFixtureEnvironment(["rust"]), CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	let built;
	try
	{
		built = await buildCanonicalProject({ projectRoot: project, outputRoot: output
			, targets: Object.keys(config.targets), environment
			, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) });
	} catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "cargo") ?? built;
	assert.equal(projection.ecosystem, "cargo"); assert.equal(projection.backend, "owned-rust-v1");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding"), rustRoot = join(output, "native/rust");
	const verified = await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot }), compiled = await json(join(rustRoot, "native-rust.json"));
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	assert.equal(verified.model.exports.length, 31); assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const options = { rustRoot, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.cargo
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	for(const mutation of ["lifetime", "source", "abi", "library"])
	{
		const forged = structuredClone(compiled), adapter = structuredClone(verified.adapter);
		let root, path, original;
		if(mutation === "lifetime") forged.ownedValues.callbackLifetime = "retained";
		else
		{
			root = mutation === "abi" ? adapterRoot : rustRoot;
			path = mutation === "abi" ? "internal/rust-abi.h" : mutation === "source" ? "src/lib.rs" : `native/linux-x64/${verified.evidence.library}`;
			original = await readFile(join(root, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* forged projection */\n")]);
			await saveLakeFile(root, path, changed);
			(mutation === "abi" ? adapter : forged).files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(forged));
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
		await assert.rejects(packageOwnedCargo({ ...options, working: join(directory, `forged-${mutation}`) }), /compiler-authenticated|generated .*source differs|embedded library differs/u);
		if(path) await saveLakeFile(root, path, original);
		await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(compiled));
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(verified.adapter));
	}
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedCargo({ ...options, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = await prepareRustCorpusDependencies({ rustRoot, directory, handoff, environment });
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const companions = {};
	for(const profile of mode === "reviewed" ? ["c", "cpp"] : [])
	{
		const cpp = profile === "cpp";
		const observed = await installCopiedConsumer({ profile, consumer, handoff
			, environment
			, packages: receipt.packages.filter(item => item.target === profile)
			, fixture: { source: () => readFile(`tests/fixtures/structured-types/${cpp ? "owned-installed-cpp.cpp" : "owned-installed-host-callbacks.c"}`, "utf8")
				, success: cpp ? "owned-installed-cpp" : "owned-installed-callbacks" } });
		companions[profile] = observed.checks;
		assert.equal(observed.checks, cpp ? 577 : 693);
	}
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
	assert.equal(manifest.kind, "lean-bridge-owned-cargo-package"); await verifyNativeFiles(installed, manifest.files);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	for(const dependency of dependencies.packages)
	{
		const root = join(consumer, "dependencies", dependency.directory), bytes = await readFile(join(root, ".cargo-checksum.json"));
		assert.equal(sha256(bytes), dependency.manifestSha256); const checksum = JSON.parse(bytes); assert.equal(checksum.package, dependency.checksum);
		for(const [path, hash] of Object.entries(checksum.files)) assert.equal(sha256(await readFile(join(root, path))), hash);
	}
	await saveLakeFile(consumer, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
	await saveLakeFile(consumer, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = await readFile("tests/fixtures/structured-types/owned-installed-rust.rs", "utf8"); await saveLakeFile(consumer, "consumer.rs", source);
	const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, consumer, env);
	await cargo(["generate-lockfile", "--offline"]); await cargo(["build", "--offline", "--locked", "--bin", "consumer"]);
	const command = join(consumer, "target/debug/consumer"), executed = await runCopied(command, [], consumer);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^owned-installed-rust:\d+\n$/u);
	const checks = Number(executed.stdout.trim().split(":")[1]); assert.ok(checks > 580);
	const preload = await runCopied(command, ["unverified Lean runtime is already loaded"], consumer
		, { ...copiedCleanEnvironment, LD_PRELOAD: join(installed, "native/linux-x64/libleanshared.so") });
	assert.equal(preload.stdout, "owned-loader-rejected\n"); assert.equal(preload.stderr, "");
	const embedded = join(installed, "native/linux-x64", verified.evidence.library), originalLibrary = await readFile(embedded);
	const corrupted = Buffer.from(originalLibrary); corrupted[0] ^= 1;
	await saveLakeFile(installed, `native/linux-x64/${verified.evidence.library}`, corrupted);
	await cargo(["build", "--offline", "--locked", "--bin", "consumer"]);
	const tampered = await runCopied(command, ["Native library differs from compiled evidence"], consumer);
	assert.equal(tampered.stdout, "owned-loader-rejected\n"); assert.equal(tampered.stderr, "");
	await saveLakeFile(installed, `native/linux-x64/${verified.evidence.library}`, originalLibrary);
	await cargo(["build", "--offline", "--locked", "--bin", "consumer"]);
	const docs = await readFile("docs/consume/rust.md", "utf8");
	const documented = docs.split("### Resource-containing values\n")[1].split("```rust\n")[1].split("\n```")[0] + "\n";
	await saveLakeFile(consumer, "src/bin/documentation.rs", documented);
	await cargo(["build", "--offline", "--locked", "--bin", "documentation"]);
	const example = await runCopied(join(consumer, "target/debug/documentation"), [], consumer);
	assert.equal(example.stderr, ""); assert.equal(example.stdout, "");
	const rejected = [];
	for(const [name, body, code] of [
		["missing-recovery", "let _ = api::factory(|()| Ok(api::Ticket::default()));", "E0277"]
		, ["wrong-kind", "let _ = api::serial(&api::identity_closure(()).unwrap());", "E0308"]
		, ["send", "fn require<T: Send>() {} require::<api::Bundle>();", "E0277"]
		, ["sync", "fn require<T: Sync>() {} require::<api::Ticket>();", "E0277"]
	]) {
		await saveLakeFile(consumer, `src/bin/${name}.rs`, `use owned_values as api; fn main() { ${body} }`);
		await assert.rejects(cargo(["check", "--offline", "--locked", "--bin", name]), error => { assert.ok(error.details.stderr.includes(code)); return true; }); rejected.push(name);
	}
	const relocated = join(directory, "relocated"); await mkdir(relocated); const relocatedCommand = join(relocated, "consumer"); await rename(command, relocatedCommand);
	await rm(consumer, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(installed), { code: "ENOENT" }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const moved = await runCopied(relocatedCommand, [], relocated, { ...copiedCleanEnvironment, RUSTC: "/unavailable", CARGO_HOME: "/unavailable" });
	assert.deepEqual(moved.stdout, executed.stdout); assert.equal(moved.stderr, "");
	await saveLakeFile(resolve("build/owned-rust-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true
		, emptyCargoHome: true, offlineInstall: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, tamperRejected: ["lifetime", "source", "abi", "library"], rejected
		, loaderRejected: ["unverified-runtime", "changed-embedded-library"]
		, documentationSha256: sha256(documented), companions
		, checks, relocatedChecks: checks, consumerSha256: sha256(source)
		, linkerSha256: sha256(linker), dependencies
		, input, componentReceipt: verified.receipt
		, adapterReceipt: verified.adapter, compiledReceipt: compiled
		, packageSetReceipt: receipt, manifest
	}));
	t.diagnostic(`${mode}: ${checks} installed checks and ${checks} source-free relocated checks`);
});

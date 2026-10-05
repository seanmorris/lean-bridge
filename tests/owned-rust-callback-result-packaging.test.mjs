/**
 * Install callback-owner crates offline and run them after removing all sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { packageOwnedCargo } from "../src/release/owned-cargo.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedNativeCFamily } from "../src/build/owned-c-projection.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedRustEvidence } from "../src/build/owned-rust-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { ownedRustCallbackResultConfiguration, ownedRustCallbackResultReviewedIr
	, ownedRustCallbackResultSource, ownedRustCallbackResultCombinedConfiguration
	, ownedRustCallbackResultCombinedReviewedIr, ownedRustCallbackResultCombinedSource } from "./helpers/owned-rust-callback-result-fixture.mjs";
import { ownedRustReceiverLinker as linker } from "./helpers/owned-rust-receiver-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`installed Rust callback-result archive (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUST_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-rust-callback-installed-${mode}-${combined}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(directory, "source");
	const output = join(directory, "producer"), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
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
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + (combined ? ownedRustCallbackResultCombinedSource : ownedRustCallbackResultSource));
	const configuration = mode === "ordinary" ? await (combined ? ownedRustCallbackResultCombinedConfiguration : ownedRustCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { cargo: { name: "owned-callback-results", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson((combined ? ownedRustCallbackResultCombinedReviewedIr : ownedRustCallbackResultReviewedIr)()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment(["rust"]), CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	for(const name of ["NODE_PATH", "NODE_OPTIONS"]) delete environment[name];
	const builds = [];
	const build = async destination => {
		if(!combined)
		{
			const runtimeRoot = join(destination, "native/runtime"), nativeRoot = join(destination, "native/component");
			const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
			await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
			const native = await buildNativeComponent({ projectRoot: project
				, outputRoot: nativeRoot, runtimeRoot, leanPrefix, targets: ["cargo"]
				, ownedGraphs: true, ownedHostCallbacks: false
				, ownedCallbackResultAnchors: true });
			const projections = await projectOwnedNativeCFamily({ working: destination
				, nativeRoot, runtimeRoot, leanPrefix, targets: ["cargo"]
				, settings: configuration.targets, environment });
			await writeNativePackageSet({ root: destination, model: native.model
				, runtimeIdentity: native.receipt.runtimeIdentity, projections });
			builds.push({ producerInterface: "native-build-api", projections });
			assert.deepEqual(await lakeInputState(project), before);
			return projections[0];
		}
		const result = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, "--target", "cargo", "--output", destination, "--json"]
			, cwd: directory, env: environment, timeoutMs: 900000 })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.deepEqual(response.result.targets, ["cargo"]); builds.push(response);
		assert.deepEqual(await lakeInputState(project), before);
		return json(join(destination, "native-release.json"));
	};
	const built = await build(output); assert.equal(built.backend, "owned-rust-v5");
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-c-binding"), rustRoot = join(output, "native/rust");
	const verified = await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt, adapter } = verified, compiled = await json(join(rustRoot, "native-rust.json"));
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["hostCallbacks", "resultAnchors", "receiverExports", "inputTransfers"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	if(!combined) await assert.rejects(access(join(nativeRoot, "callbacks.c")), { code: "ENOENT" });
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(compiled.schemaVersion, 6); assert.equal(adapter.schemaVersion, 7);
	assert.equal(adapter.ownedValues.schemaVersion, 6); assert.equal(adapter.rustValues.schemaVersion, 5);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: combined
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true };
	const incapable = ["ownedCallbackResultAnchors", ...combined ? ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"] : []];
	for(const key of incapable)
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
	const packageOptions = { rustRoot, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.cargo
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedCargo({ ...packageOptions, working: reassembled });
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
		value => { delete value.ownedValues.callbackResultAnchors; }
		, value => { value.ownedValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.ownedValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.ownedValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.ownedValues.callbackResultAnchors.expiration = "never"; }
		, value => { value.ownedValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.ownedValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.schemaVersion = 6; value.ownedValues.schemaVersion = 5; }
		, value => { delete value.rustValues.callbackResultAnchors; }
		, value => { value.rustValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.rustValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.rustValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.rustValues.callbackResultAnchors.parameterNumbering = "includes-closure"; }
		, value => { value.rustValues.callbackResultAnchors.hostReply = "unchecked"; }
		, value => { value.rustValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.rustValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.rustValues.callbackResultAnchors.emptyValues = "unowned"; }
		, value => { value.rustValues.schemaVersion = 4; }
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(changed));
		await assert.rejects(packageOwnedCargo({ ...packageOptions, working: join(directory, "forged") }), /compiler-authenticated/u);
		rejected++;
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of ["src/lib.rs", "src/owned_values.rs", "src/assets.rs"])
	{
		const original = await readFile(join(rustRoot, path));
		const changed = Buffer.concat([original, Buffer.from("\n// changed callback ownership\n")]);
		const forged = structuredClone(compiled); forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(rustRoot, path, changed);
		await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(forged));
		await assert.rejects(packageOwnedCargo({ ...packageOptions, working: join(directory, "forged") }), /generated source differs/u);
		rejected++;
		await saveLakeFile(rustRoot, path, original);
		await saveLakeFile(rustRoot, "native-rust.json", canonicalJson(compiled));
	}
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = await prepareRustCorpusDependencies({ rustRoot, directory, handoff, environment });
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	for(const path of [project, output]) await assert.rejects(access(path), { code: "ENOENT" });
	const verification = candidate ? JSON.parse((await runCopied(process.execPath, [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], directory)).stdout) : null;
	if(verification)
	{ assert.equal(verification.status, "ok"); assert.equal(verification.result.verificationType, "local-package-set"); }
	await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	const pkg = handoffReceipt.packages.find(item => item.target === "cargo" && item.role === "component");
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
	assert.equal(manifest.schemaVersion, 6); await verifyNativeFiles(installed, manifest.files);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	await saveLakeFile(consumer, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
	await saveLakeFile(consumer, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[features]\nhost=[]\ncombined=["host"]\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = "use owned_callback_results::*;\n" + await readFile("tests/fixtures/structured-types/owned-rust-callback-results.rs", "utf8");
	await saveLakeFile(consumer, "consumer.rs", source);
	const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, consumer, env);
	await cargo(["generate-lockfile", "--offline"]);
	await cargo(["build", "--offline", "--locked", "--bin", "consumer", ...combined ? ["--features", "combined"] : []]);
	const command = join(consumer, "target/debug/consumer"), executed = await runCopied(command, [], consumer);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^owned-rust-callback-results:\d+\n$/u);
	const checks = Number(executed.stdout.trim().split(":")[1]);
	assert.equal(checks, combined ? 118 : 93, executed.stdout);
	const documented = await readFile("tests/fixtures/documentation/consumers/rust/owned-callback-results.rs", "utf8");
	assert.equal((await readFile("docs/consume/rust.md", "utf8")).match(/```rust file=rust\/owned-callback-results\.rs\n([\s\S]*?)```/u)?.[1], documented);
	await saveLakeFile(consumer, "src/bin/documentation.rs", documented);
	await cargo(["build", "--offline", "--locked", "--bin", "documentation"]);
	const example = await runCopied(join(consumer, "target/debug/documentation"), [], consumer);
	assert.equal(example.stderr, ""); assert.equal(example.stdout, "42\n");
	const relocated = join(directory, "relocated"); await mkdir(relocated);
	const relocatedCommand = join(relocated, "consumer"); await rename(command, relocatedCommand);
	await rm(consumer, { recursive: true }); await rm(handoff, { recursive: true });
	for(const path of [installed, consumer, handoff]) await assert.rejects(access(path), { code: "ENOENT" });
	const moved = await runCopied(relocatedCommand, [], relocated, { ...copiedCleanEnvironment, RUSTC: "/unavailable", CARGO_HOME: "/unavailable" });
	assert.equal(moved.stdout, executed.stdout); assert.equal(moved.stderr, "");
	await saveLakeFile("build/owned-rust-callback-results", `${mode}-${combined ? "combined" : "no-host"}-package.json`, canonicalJson({
		mode, combined, hostCallbacks: combined, metadata, model, receipt
		, adapter, compiled, manifest, packages: built.packages
		, cli: candidate?.report ?? null
		, cliInstallation: candidate ? { offline: true
			, filesVerified: candidate.report.files.length, sourceRemoved: true } : null
		, builds, verification, sourceRemovedBeforeInstall: true
		, cliRemovedBeforeConsumerInstall: true
		, independentRebuild: true, deterministicReassembly: true
		, rejected, incapableReadersRejected: incapable.length
		, sourceFreeInstallation: true, emptyCargoHome: true, offlineInstall: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, checks, relocatedChecks: checks
		, consumerSha256: sha256(source), linkerSha256: sha256(linker), dependencies
		, documentation: { sourceSha256: sha256(documented), stdout: example.stdout }
	}));
	t.diagnostic(`${mode}-${combined ? "combined" : "no-host"}: ${checks} installed assertions, deterministic archives, relocated execution`);
});

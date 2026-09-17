/**
 * Compile installed Cargo consumers offline, then run relocated source-free binaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { corpusCases, corpusHostCase } from "../fixtures/type-corpus/cases.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusRustRejection, corpusRustSignatures, corpusRustSource } from "./type-corpus-rust-source.mjs";

const repository = resolve(import.meta.dirname, "../..");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const target = "x86_64-unknown-linux-gnu";
const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;

/**
 * Preserve complete rustc JSON on nonzero exits; display-tail truncation is unsafe.
 *
 * @param command - Absolute compiler driver.
 * @param args - Cargo check arguments, including JSON diagnostics.
 * @param cwd - Isolated installed consumer project.
 * @param env - Restricted compiler environment.
 */
export const captureRustCompiler = (command, args, cwd, env) => new Promise((accept, reject) => {
	const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
	const stdout = [], stderr = [];
	let size = 0, failure;
	const stop = reason => { failure ??= new Error(reason); child.kill("SIGKILL"); };
	const timer = setTimeout(() => stop("Cargo compiler check exceeded 180 seconds"), 180_000);
	const collect = output => bytes => {
		size += bytes.length;
		if(size > 8 * 1024 ** 2) stop("Cargo compiler diagnostics exceeded 8 MiB");
		else output.push(bytes);
	};
	child.stdout.on("data", collect(stdout));
	child.stderr.on("data", collect(stderr));
	child.once("error", error => { clearTimeout(timer); reject(error); });
	child.once("close", code => {
		clearTimeout(timer);
		if(failure) reject(failure);
		else accept({ code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
	});
});

/**
 * Copy the exact locked registry closure into a portable dependency handoff.
 *
 * @param options - Author-side checked Cargo project and private staging.
 * @param options.rustRoot - Compiled package sources containing the dependency lock.
 * @param options.directory - Task-owned scratch root.
 * @param options.handoff - Prepared archive handoff receiving vendored dependencies.
 * @param options.environment - Author Cargo cache and compiler selection.
 */
export const prepareRustCorpusDependencies = async ({ rustRoot, directory, handoff, environment }) => {
	const cargo = environment.LEAN_BRIDGE_CARGO, rustc = environment.LEAN_BRIDGE_RUSTC;
	assert.ok(cargo?.startsWith("/") && rustc?.startsWith("/"), "Rust corpus needs absolute LEAN_BRIDGE_CARGO and LEAN_BRIDGE_RUSTC paths");
	const vendor = join(directory, "rust-dependencies");
	// Fetch the whole pinned closure, including dependencies conditional on other
	// platforms that a local cargo check does not download. Consumers stay offline.
	await run(cargo, ["fetch", "--locked"], rustRoot, { ...environment, RUSTC: rustc });
	await run(cargo, ["vendor", "--locked", "--offline", "--versioned-dirs", vendor], rustRoot, { ...environment, RUSTC: rustc });
	const packages = [];
	for(const name of (await readdir(vendor)).sort())
	{
		const checksum = await json(join(vendor, name, ".cargo-checksum.json"));
		assert.match(checksum.package, /^[a-f0-9]{64}$/);
		packages.push({ directory: name, checksum: checksum.package
			, files: Object.keys(checksum.files).length
			, manifestSha256: await digest(join(vendor, name, ".cargo-checksum.json")) });
	}
	assert.ok(packages.some(pkg => pkg.directory === "num-bigint-0.4.6"));
	assert.ok(packages.some(pkg => pkg.directory === "sha2-0.10.9"));
	const bytes = await createDeterministicTarGz({ directory: vendor, archiveRoot: "dependencies", sourceDateEpoch: 1 });
	const archive = "rust-dependencies.tar.gz";
	await saveLakeFile(handoff, archive, bytes);
	return { archive, sha256: sha256(bytes), packages, lockSha256: await digest(join(rustRoot, "Cargo.lock")) };
};

/**
 * Exercise an installed crate, separate compile failures, and remove all sources.
 *
 * @param options - Verified package and the freshly evaluated Lean oracle.
 * @param options.library - Independent corpus library.
 * @param options.consumer - Private consumer root.
 * @param options.handoff - Relocated prepared archives, never an author checkout.
 * @param options.pkg - Verified component package receipt entry.
 * @param options.dependencies - Locked dependency handoff.
 * @param options.environment - Selected Rust toolchain paths.
 * @param options.clean - Runtime environment without compiler access.
 */
export const installedRustCorpus = async ({ library, consumer, handoff, pkg, dependencies, environment, clean }) => {
	const root = join(consumer, "rust"), project = join(root, "project"), bin = join(project, "tools");
	await mkdir(bin, { recursive: true });
	const compiler = await realpath(environment.LEAN_BRIDGE_RUSTC), cargo = await realpath(environment.LEAN_BRIDGE_CARGO);
	await symlink("/usr/bin/ld", join(bin, "ld"));
	await saveLakeFile(bin, "link-only", linker);
	await chmod(join(bin, "link-only"), 0o755);
	const cargoHome = join(project, "cargo-home");
	await mkdir(cargoHome);
	assert.deepEqual(await readdir(cargoHome), []);
	const compile = { ...clean, PATH: bin, RUSTC: compiler, CARGO_HOME: cargoHome
		, CARGO_TARGET_DIR: join(project, "target"), CARGO_NET_OFFLINE: "true"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(bin, "link-only") };
	const rustcVersion = (await run(compiler, ["--version"], project, compile)).stdout.trim();
	const cargoVersion = (await run(cargo, ["--version"], project, compile)).stdout.trim();
	assert.match(rustcVersion, /^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /);
	const vendor = join(project, "vendor");
	await mkdir(vendor);
	const unpack = path => run("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", path, "-C", vendor], project, clean);
	const dependencyArchive = join(consumer, "rust-dependencies", dependencies.archive);
	assert.equal(await digest(dependencyArchive), dependencies.sha256);
	await unpack(join(handoff, pkg.artifacts[0].path));
	await unpack(dependencyArchive);
	const installed = join(vendor, `${pkg.name}-${pkg.version}`);
	assert.equal(await digest(join(installed, "Cargo.lock")), dependencies.lockSha256);
	const receiptPath = join(installed, "lean-bridge/package-receipt.json"), receipt = await json(receiptPath);
	assert.equal(receipt.name, pkg.name);
	assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	for(const [path, file] of Object.entries(receipt.files)) assert.equal(await digest(join(installed, path)), file.sha256);
	for(const dependency of dependencies.packages)
	{
		const path = join(vendor, "dependencies", dependency.directory);
		assert.equal(await digest(join(path, ".cargo-checksum.json")), dependency.manifestSha256);
		const checksum = await json(join(path, ".cargo-checksum.json"));
		for(const [file, hash] of Object.entries(checksum.files)) assert.equal(await digest(join(path, file)), hash);
	}
	await saveLakeFile(project, ".cargo/config.toml", '[source.crates-io]\nreplace-with = "corpus-vendor"\n[source.corpus-vendor]\ndirectory = "vendor/dependencies"\n');
	await saveLakeFile(project, "Cargo.toml", `[package]\nname = "corpus-consumer"\nversion = "0.0.0"\nedition = "2021"\n[dependencies]\n${pkg.name} = { path = "vendor/${pkg.name}-${pkg.version}" }\n[profile.dev]\ndebug = 0\nincremental = false\n`);
	const source = corpusRustSource(library);
	await saveLakeFile(project, "src/main.rs", source);
	await saveLakeFile(project, "src/wire.rs", await readFile(join(repository, "tests/fixtures/type-corpus/consumers/rust.rs")));
	const negatives = corpusCases(library).map(entry => corpusHostCase(entry, "rust")).filter(entry => entry.expectation.kind === "compile-rejection");
	const rejectedSources = negatives.map(entry => ({ entry, name: `reject-${entry.id.split("/")[1]}`, source: corpusRustRejection(library, entry) }));
	for(const negative of rejectedSources) await saveLakeFile(project, `src/bin/${negative.name}.rs`, negative.source);
	await run(cargo, ["generate-lockfile", "--offline"], project, compile);
	const args = ["--locked", "--offline", "--target", target];
	const metadata = JSON.parse((await run(cargo, ["metadata", ...args.filter(arg => arg !== "--target" && arg !== target), "--format-version", "1"], project, compile)).stdout);
	const publicPackage = metadata.packages.find(item => item.name === pkg.name);
	assert.equal(await realpath(publicPackage.manifest_path), join(installed, "Cargo.toml"));
	assert.equal(publicPackage.version, pkg.version);
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort(), dependencies.packages.map(item => item.directory).sort());
	for(const item of registry) assert.equal(await realpath(item.manifest_path), join(vendor, "dependencies", `${item.name}-${item.version}`, "Cargo.toml"));
	await run(cargo, ["build", ...args, "--bin", "corpus-consumer"], project, compile);
	const rejected = [];
	for(const { entry, name, source } of rejectedSources)
	{
		const failure = await captureRustCompiler(cargo, ["check", ...args, "--bin", name, "--message-format=json"], project, compile);
		assert.equal(failure.code, 101, `${entry.id}: expected compilation rejection: ${failure.stderr.slice(-4000)}`);
		const messages = failure.stdout.trim().split("\n").map(line => JSON.parse(line));
		const diagnostics = messages.filter(message => message.reason === "compiler-message" && message.message.level === "error").map(({ message }) => {
			const primary = message.spans.filter(span => span.is_primary);
			assert.ok(primary.length > 0);
			assert.ok(primary.every(span => span.file_name === `src/bin/${name}.rs`));
			assert.equal(message.code?.code, entry.expectation.diagnostic);
			return { code: message.code.code, file: primary[0].file_name, line: primary[0].line_start, column: primary[0].column_start };
		});
		assert.ok(diagnostics.length > 0);
		rejected.push({ id: entry.id, status: "rejected-at-compile-time", sourceSha256: sha256(source), diagnostics });
	}
	const rust = { rustcVersion, cargoVersion
		, compilerSha256: await digest(compiler), cargoSha256: await digest(cargo)
		, consumerSourceSha256: sha256(source)
		, signaturesSha256: sha256(corpusRustSignatures(library))
		, declarationsSha256: await digest(join(installed, "src/lib.rs"))
		, packageReceiptSha256: await digest(receiptPath)
		, compiledProjectionSha256: receipt.compiledProjectionSha256
		, bindingIrSha256: receipt.bindingIrSha256
		, lockSha256: await digest(join(project, "Cargo.lock"))
		, metadataSha256: sha256(canonicalJson(metadata))
		, dependencies, linkerSha256: sha256(linker)
		, installedSourcesRemoved: true, emptyCargoHome: true, offline: true
		, linkOnly: true };
	const executable = join(root, "relocated-consumer");
	await rename(join(project, "target", target, "debug/corpus-consumer"), executable);
	rust.executableSha256 = await digest(executable);
	await rm(project, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated-consumer"]);
	const registryBefore = (await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/.test(name)).sort();
	const actual = JSON.parse((await run(executable, [], root, { ...clean, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" })).stdout);
	const repeated = JSON.parse((await run(executable, [], root, { ...clean, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" })).stdout);
	assert.deepEqual(actual, repeated);
	assert.deepEqual((await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/.test(name)).sort(), registryBefore);
	rust.normalExitCleanup = true;
	rust.repeatExecution = true;
	assert.equal(actual.results.length + rejected.length, corpusCases(library).length);
	actual.hostVersion = rustcVersion.split(" ")[1];
	actual.results.push(...rejected);
	return { observation: actual, rust };
};

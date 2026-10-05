/**
 * Offline enum consumers, source-free relocation and private RAII fault probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureRustCompiler } from "./type-corpus-rust.mjs";

const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;
const digest = async path => sha256(await readFile(path));

/**
 * Install only the original crate and independently checksummed dependency closure.
 *
 * @param options - Private consumer roots and compiler-authenticated projection.
 * @param options.consumer - Task-owned temporary root.
 * @param options.handoff - Verified original package handoff.
 * @param options.packages - Receipt package entries.
 * @param options.dependencies - Pinned vendored dependency identities.
 * @param options.environment - Explicit Rust toolchain paths.
 * @param options.projection - Private layout names for separate malformed-value probes.
 */
export const installRustVariants = async ({ consumer, handoff, packages, dependencies, environment, projection }) => {
	const root = join(consumer, "rust"), tools = join(root, "tools"), pkg = packages.find(item => item.role === "component");
	await mkdir(tools, { recursive: true });
	await symlink("/usr/bin/ld", join(tools, "ld"));
	await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	const cargoHome = join(root, "cargo-home"); await mkdir(cargoHome);
	assert.deepEqual(await readdir(cargoHome), []);
	const env = { ...copiedCleanEnvironment
		, PATH: tools
		, RUSTC: environment.LEAN_BRIDGE_RUSTC
		, CARGO_HOME: cargoHome, CARGO_NET_OFFLINE: "true"
		, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(tools, "link-only") };
	const cargo = environment.LEAN_BRIDGE_CARGO;
	const version = (await runCopied(environment.LEAN_BRIDGE_RUSTC, ["--version"], root, env)).stdout.trim();
	const dependencyArchive = join(consumer, "dependencies", dependencies.archive);
	assert.equal(await digest(dependencyArchive), dependencies.sha256);
	for(const archive of [join(handoff, pkg.artifacts[0].path), dependencyArchive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge/package-receipt.json")));
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	await verifyNativeFiles(installed, receipt.files);
	assert.equal(await digest(join(installed, "Cargo.lock")), dependencies.lockSha256);
	for(const dependency of dependencies.packages)
	{
		const path = join(root, "dependencies", dependency.directory);
		assert.equal(await digest(join(path, ".cargo-checksum.json")), dependency.manifestSha256);
		const checksum = JSON.parse(await readFile(join(path, ".cargo-checksum.json")));
		for(const [file, hash] of Object.entries(checksum.files)) assert.equal(await digest(join(path, file)), hash);
	}
	await saveLakeFile(root, ".cargo/config.toml", '[source.crates-io]\nreplace-with = "prepared"\n[source.prepared]\ndirectory = "dependencies"\n');
	await saveLakeFile(root, "Cargo.toml", `[package]\nname="variant-consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = await readFile("tests/fixtures/variant-consumers/rust.rs", "utf8");
	await saveLakeFile(root, "src/main.rs", source);
	await runCopied(cargo, ["generate-lockfile", "--offline"], root, env);
	await runCopied(cargo, ["rustc", "--offline", "--locked", "--bin", "variant-consumer", "--", "-Dwarnings"], root, env);
	const executable = join(root, "target/debug/variant-consumer");
	const result = await runCopied(executable, [], root);
	assert.equal(result.stderr, ""); assert.match(result.stdout, /^variant-rust-ok:\d+:\d+\n$/);
	const [checks, calls] = result.stdout.trim().split(":").slice(1).map(Number); assert.ok(checks > 4000 && calls > 4000);
	const negatives = JSON.parse(await readFile("tests/fixtures/variant-consumers/rust-invalid.json")), rejected = [];
	for(const { name, statement, code } of negatives)
	{
		const source = `use variants_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const failure = await captureRustCompiler(cargo, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(failure.code, 101, failure.stderr);
		const diagnostics = failure.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), failure.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const variants = projection.surface.copies.filter(copy => copy.variant);
	const malformed = `
#[cfg(test)] mod malformed_variants {
    use super::*;
    #[test] fn tags_reject_before_poisoned_union_payloads_are_read() {
${variants.map(copy => `        let mut value = ${copy.ctype} { kind: u32::MAX, ..Default::default() };
        unsafe { std::ptr::write_bytes(&mut value.cases as *mut V${copy.index}, 0xff, 1) };
        assert!(matches!(from${copy.index}(&value, &mut Scope::new()), Err(Error::InvalidNative)));`).join("\n")}
${variants.filter(copy => copy.cases.length > 1).map(copy => `        let mut value = ${copy.ctype}::default();
        unsafe { std::ptr::write_bytes(&mut value.cases as *mut V${copy.index}, 0xff, 1) };
        value.cases.case0 = B${copy.index}_0::default();
        assert!(matches!(from${copy.index}(&value, &mut Scope::new()).unwrap(), crate::${copy.publicName}::${copy.cases[0].publicName}${copy.cases[0].fields.length ? " { .. }" : ""}));`).join("\n")}
        assert_eq!(crate::make(0).unwrap(), crate::Signal::Idle);
    }
}
`;
	const runtime = await readFile(join(installed, "src/__runtime.rs"), "utf8");
	const faults = await readFile("tests/fixtures/variant-consumers/rust-faults.rs", "utf8");
	await saveLakeFile(installed, "src/__runtime.rs", `${runtime}\n${faults}\n${malformed}`);
	const tested = await runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--manifest-path", join(installed, "Cargo.toml"), "--", "--test-threads=1", "--nocapture"], root, env);
	assert.match(tested.stdout, /2 passed; 0 failed/);
	const faultChecks = Number(tested.stdout.match(/variant-faults:(\d+)/)?.[1]); assert.ok(faultChecks > 100);
	await saveLakeFile(installed, "src/__runtime.rs", runtime);
	await verifyNativeFiles(installed, receipt.files);
	const declarationsSha256 = await digest(join(installed, "src/lib.rs"));
	const moved = join(consumer, "relocated-consumer"); await rename(executable, moved);
	await rm(root, { recursive: true, force: true });
	await rm(handoff, { recursive: true, force: true });
	await rm(join(consumer, "dependencies"), { recursive: true, force: true });
	const registry = async () => (await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/.test(name)).sort();
	const before = await registry();
	for(let repeat = 0; repeat < 2; repeat++)
	{
		const repeated = await runCopied(moved, [], consumer, { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" });
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout, result.stdout);
		assert.deepEqual(await registry(), before);
	}
	return { checks, calls
		, consumerSha256: sha256(source), declarationsSha256, version
		, offlineInstall: true, compilerFreePath: true
		, emptyCargoHome: true, linkOnly: true
		, relocatedExecutable: true, installedSourcesRemoved: true
		, handoffRemovedBeforeExecution: true
		, repeatExecution: true, normalExitCleanup: true
		, installedFilesUnchanged: true
		, installedFilesSha256: sha256(canonicalJson(receipt.files))
		, installedFiles: receipt.files
		, nativeLibraries: Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /\.so(?:\.|$)/.test(path)))
		, dependencies, linkerSha256: sha256(linker)
		, executableSha256: await digest(moved)
		, rejected
		, rejectionSourceSha256: await digest("tests/fixtures/variant-consumers/rust-invalid.json")
		, faultTests: 2, faultChecks
		, faultSourceSha256: sha256(faults)
		, malformedTags: variants.length
		, inactiveCases: variants.filter(copy => copy.cases.length > 1).length
		, malformedSourceSha256: sha256(malformed) };
};

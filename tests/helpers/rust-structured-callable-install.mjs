/**
 * Installed structured Rust compile-time guards, fault cleanup and source-free use.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureRustCompiler } from "./type-corpus-rust.mjs";

/**
 * Authenticate failure coverage for each copied shape independently.
 *
 * @param stdout - Actual installed-crate test output.
 */
export const parseStructuredRustFaults = stdout => {
	const faults = [...stdout.matchAll(/structured-rust-faults:(\w+):(\d+):(\d+)/gu)]
		.map(([, shape, cases, failures]) => ({ shape, cases: Number(cases), failures: Number(failures) }));
	assert.deepEqual(faults.map(item => item.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
	for(const entry of faults)
	{
		assert.equal(entry.cases, 5); assert.ok(entry.failures > 0); assert.equal(entry.failures % 2, 0);
	}
	return faults;
};

/**
 * Validate the installed crate, then run its executable after deleting all sources.
 *
 * @param options - Relocated consumer, selected tools and verified packages.
 * @param options.consumer - Owned consumer root.
 * @param options.handoff - Relocated package archives.
 * @param options.environment - Absolute Rust tool paths.
 * @param options.packages - Verified receipt entries.
 * @param options.command - Built executable path.
 * @param options.checks - Public consumer checks observed before relocation.
 */
export const checkStructuredRustInstallation = async ({ consumer, handoff, environment, packages, command, checks }) => {
	const root = join(consumer, "rust"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" };
	const guide = await readFile("docs/consume/rust.md", "utf8");
	const documented = guide.match(/### Structured callback values\n[\s\S]*?```rust\n([\s\S]*?)```/u)?.[1];
	assert.ok(documented, "The Rust consumer guide must contain its structured example");
	await saveLakeFile(root, "src/bin/documented.rs", documented);
	await runCopied(environment.LEAN_BRIDGE_CARGO, ["build", "--offline", "--locked", "--bin", "documented"], root, env);
	const documentedRun = await runCopied(join(root, "target/debug/documented"), [], root);
	assert.equal(documentedRun.stdout, ""); assert.equal(documentedRun.stderr, "");
	const negatives = [
		["argument", 'api::call_record("wrong", Ok).unwrap();', "E0308"]
		, ["callback-argument", 'api::call_array(&[], |v: &[Option<String>]| Ok(v.to_vec())).unwrap();', "E0631"]
		, ["callback-result", 'api::call_array(&[], |v| v).unwrap();', "E0308"]
		, ["borrowed-result", 'api::call_array(&[], |v| Ok(&v)).unwrap();', "E0308"]
		, ["nested-option", 'api::call_option(&Some(()), Ok).unwrap();', "E0308"]
		, ["closure-argument", 'api::make_option(&None).unwrap().call(true, 1).unwrap();', "E0308"]
		, ["send", 'fn send<T: Send>(_: T) {} send(api::make_array(&[]).unwrap());', "E0277"]
		, ["sync", 'fn sync<T: Sync>(_: &T) {} sync(&api::make_array(&[]).unwrap());', "E0277"]
		, ["clone", 'api::make_array(&[]).unwrap().clone();', "E0599"]
		, ["async", 'api::call_array(&[], |v| async move { Ok(v) }).unwrap();', "E0308"]
		, ["moved", 'let value = api::make_array(&[]).unwrap(); let moved = value; value.call(true, &[]).unwrap(); drop(moved);', "E0382"]
	];
	const rejected = [];
	for(const [name, statement, code] of negatives)
	{
		const source = `use structured_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const failure = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(failure.code, 101, failure.stderr);
		const diagnostics = failure.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), failure.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const runtimePath = join(installed, "src/__runtime.rs"), original = await readFile(runtimePath, "utf8");
	const faultSource = await readFile("tests/fixtures/structured-callable-consumers/rust-faults.rs", "utf8");
	await saveLakeFile(installed, "src/__runtime.rs", `${original}\n${faultSource}`);
	const checked = await runCopied(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--lib", "--manifest-path", join(installed, "Cargo.toml"), "--", "--test-threads=1", "--nocapture"], root, env);
	assert.match(checked.stdout, /1 passed; 0 failed/);
	const faults = parseStructuredRustFaults(checked.stdout);
	await saveLakeFile(installed, "src/__runtime.rs", original);
	const executable = join(consumer, "relocated-consumer");
	await cp(command, executable);
	await Promise.all([root, handoff, join(consumer, "dependencies")].map(directory => rm(directory, { recursive: true, force: true })));
	const executed = await runCopied(executable, [], consumer);
	assert.equal(executed.stderr, ""); assert.equal(executed.stdout, `structured-rust-ok:${checks}\n`);
	return {
		rejected, faults, faultTests: 1
		, faultSourceSha256: sha256(faultSource)
		, documentedSourceSha256: sha256(documented)
		, documentedExampleExecuted: true
		, executableSha256: sha256(await readFile(executable))
		, sourceFreeChecks: checks
		, sourcesAndArchivesRemovedBeforeExecution: true };
};

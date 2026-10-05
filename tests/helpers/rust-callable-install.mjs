/**
 * Compile-time safety checks, conversion fault injection and source-free Rust use.
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
 * Check installed APIs without a Lean checkout, then remove every crate source.
 *
 * @param root0 - Relocated installed consumer and selected Rust tools.
 * @param root0.consumer - Task-owned consumer root.
 * @param root0.environment - Absolute producer-side tool paths.
 * @param root0.packages - Verified archive receipt entries.
 * @param root0.command - Compiled consumer executable.
 */
export const checkRustCallableInstallation = async ({ consumer, environment, packages, command }) => {
	const root = join(consumer, "rust"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" };
	const negatives = [
		["argument", 'api::call_uint32("wrong", Ok).unwrap();', "E0308"]
		, ["result", 'api::call_uint32(0, |v| v).unwrap();', "E0308"]
		, ["borrowed-callback-input", 'api::call_string("", |v: &str| Ok(v.to_owned())).unwrap();', "E0631"]
		, ["closure-argument", 'api::make_uint32(1).unwrap().call(true, "bad").unwrap();', "E0308"]
		, ["send", 'fn send<T: Send>(_: T) {} send(api::make_uint32(1).unwrap());', "E0277"]
		, ["sync", 'fn sync<T: Sync>(_: &T) {} sync(&api::make_uint32(1).unwrap());', "E0277"]
		, ["clone", 'api::make_uint32(1).unwrap().clone();', "E0599"]
		, ["async", 'api::call_uint32(0, |v| async move { Ok(v) }).unwrap();', "E0308"]
	];
	const rejected = [];
	for(const [name, statement, code] of negatives)
	{
		const source = `use callables_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const failure = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(failure.code, 101, failure.stderr);
		const diagnostics = failure.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), failure.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const runtimePath = join(installed, "src/__runtime.rs"), original = await readFile(runtimePath, "utf8");
	const faults = await readFile("tests/fixtures/callable-consumers/rust-faults.rs", "utf8");
	await saveLakeFile(installed, "src/__runtime.rs", `${original}\n${faults}`);
	const checked = await runCopied(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--lib", "--manifest-path", join(installed, "Cargo.toml"), "--", "--test-threads=1"], root, env);
	assert.match(checked.stdout, /1 passed; 0 failed/);
	await saveLakeFile(installed, "src/__runtime.rs", original);
	const executable = join(consumer, "relocated-consumer");
	await cp(command, executable);
	await rm(root, { recursive: true, force: true });
	const executed = await runCopied(executable, [], consumer);
	assert.equal(executed.stderr, "");
	assert.match(executed.stdout, /^callable-rust-ok:\d+\n$/);
	return { rejected, faultTests: 1, faultSourceSha256: sha256(faults), executableSha256: sha256(await readFile(executable)), sourceFreeChecks: Number(executed.stdout.trim().split(":")[1]) };
};

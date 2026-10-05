/**
 * Rust compound static rejection, private fault checks and source-free execution.
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
 * Check only the installed crate, then relocate the executable without sources.
 *
 * @param root0 - Installed package, compiler tools and private projection indices.
 * @param root0.consumer - Task-owned consumer directory.
 * @param root0.environment - Absolute Rust tool paths.
 * @param root0.packages - Verified receipt entries.
 * @param root0.command - Independently compiled positive consumer.
 * @param root0.projection - Private type indices for malformed-output probes.
 */
export const checkRustCompoundInstallation = async ({ consumer, environment, packages, command, projection }) => {
	const root = join(consumer, "rust"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" };
	const negatives = [
		["option-payload", "api::option_uint32(&Some(true));", "E0308"]
		, ["option-unit", "api::option_unit(&Some(0u8));", "E0308"]
		, ["result-payload", 'api::result_uint32(&Ok("wrong"));', "E0308"]
		, ["bare-payload", "api::option_uint32(&42);", "E0308"]
		, ["missing-borrow", "api::option_uint32(Some(42));", "E0308"]
		, ["product-arity", "api::tuple_uint32(&(1, 2, 3));", "E0308"]
		, ["product-array", "api::tuple_uint32(&[1, 2]);", "E0308"]
		, ["nested-option", "api::classify(&Some(()));", "E0308"]
		, ["negative-nat", "api::option_nat(&Some(api::BigInt::from(-1)));", "E0308"]
		, ["domain-versus-boundary", "let _: Result<u32, api::Error> = api::result_uint32(&Ok(1));", "E0308"]
		, ["fixed-overflow", "let _ = api::option_uint8(&Some(256u8));", "overflowing_literals"]
	];
	const rejected = [];
	for(const [name, statement, code] of negatives)
	{
		const source = `use compounds_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const failure = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(failure.code, 101, failure.stderr);
		const diagnostics = failure.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), failure.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const shape = field => projection.surface.copy(projection.surface.functions.find(fn => fn.field === field).declaration.result.type);
	const option = shape("option_string"), result = shape("result_string");
	const malformed = `
#[cfg(test)] mod compound_flags {
    use super::*;
    #[test] fn invalid_flags_reject_and_inactive_payloads_are_not_read() {
        for flag in [2, 127, 255] {
            let a = ${option.ctype} { has_value: flag, ..Default::default() };
            assert!(matches!(from${option.index}(&a, &mut Scope::new()), Err(Error::InvalidNative)));
            let b = ${result.ctype} { is_ok: flag, ..Default::default() };
            assert!(matches!(from${result.index}(&b, &mut Scope::new()), Err(Error::InvalidNative)));
        }
        let mut a = ${option.ctype}::default();
        a.value.data = std::ptr::dangling(); a.value.length = usize::MAX;
        assert_eq!(from${option.index}(&a, &mut Scope::new()).unwrap(), None);
        let mut b = ${result.ctype} { is_ok: 1, ..Default::default() };
        b.error.data = std::ptr::dangling(); b.error.length = usize::MAX;
        assert_eq!(from${result.index}(&b, &mut Scope::new()).unwrap(), Ok(String::new()));
        let mut b = ${result.ctype}::default();
        b.ok.data = std::ptr::dangling(); b.ok.length = usize::MAX;
        assert_eq!(from${result.index}(&b, &mut Scope::new()).unwrap(), Err(String::new()));
    }
}
`;
	const runtimePath = join(installed, "src/__runtime.rs"), original = await readFile(runtimePath, "utf8");
	const faults = await readFile("tests/fixtures/compound-consumers/rust-faults.rs", "utf8");
	await saveLakeFile(installed, "src/__runtime.rs", `${original}\n${faults}\n${malformed}`);
	const checked = await runCopied(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--lib", "--manifest-path", join(installed, "Cargo.toml"), "--", "--test-threads=1", "--nocapture"], root, env);
	assert.match(checked.stdout, /2 passed; 0 failed/);
	const faultChecks = Number(checked.stdout.match(/compound-faults:(\d+)/)?.[1]); assert.ok(faultChecks > 50);
	await saveLakeFile(installed, "src/__runtime.rs", original);
	const executable = join(consumer, "relocated-consumer");
	await cp(command, executable);
	await rm(root, { recursive: true, force: true });
	const executed = await runCopied(executable, [], consumer);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^compound-rust-ok:\d+\n$/);
	return { rejected, faultTests: 2, faultChecks, faultSourceSha256: sha256(faults), malformedSourceSha256: sha256(malformed), executableSha256: sha256(await readFile(executable)), sourceFreeChecks: Number(executed.stdout.trim().split(":")[1]) };
};

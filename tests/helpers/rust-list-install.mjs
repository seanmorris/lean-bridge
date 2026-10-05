/**
 * Installed Rust List rejection, cleanup and source-free execution checks.
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
 * Verify installed public types, instrument private conversions, then remove sources.
 *
 * @param root0 - Installed package and selected compiler.
 * @param root0.consumer - Test-owned consumer root.
 * @param root0.environment - Absolute tool paths.
 * @param root0.packages - Verified receipt entries.
 * @param root0.command - Compiled positive consumer executable.
 * @param root0.projection - Private type indices for malformed outputs.
 */
export const checkRustListInstallation = async ({ consumer, environment, packages, command, projection }) => {
	const root = join(consumer, "rust"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" };
	const negatives = [
		["element-type", "api::reverse_uint32(&[true]);", "E0308"]
		, ["unit-element", "api::reverse_unit(&[0u8]);", "E0308"]
		, ["missing-borrow", "api::reverse_uint32(vec![1]);", "E0308"]
		, ["product-arity", "api::swap(&Ok((vec![], vec![], vec![])));", "E0308"]
		, ["wrong-nesting", "api::mix(&[1u32]);", "E0308"]
		, ["option-presence", "api::nest(&vec![Ok(vec![()])]);", "E0308"]
		, ["negative-nat", "api::reverse_nat(&[api::BigInt::from(-1)]);", "E0308"]
		, ["wrong-record-field", "let _: api::Packet = api::Packet { sequences: vec![1], branches: vec![], buffers: vec![], arrays: vec![] };", "E0308"]
		, ["domain-versus-boundary", "let _: Result<Vec<String>, api::Error> = api::swap(&Err(vec![]));", "E0308"]
		, ["borrowed-result", "let _: &[u32] = api::reverse_uint32(&[1]).unwrap();", "E0308"]
		, ["fixed-overflow", "let _ = api::reverse_uint8(&[256u8]);", "overflowing_literals"]
		, ["platform-overflow", "let _ = api::reverse_usize(&[18446744073709551616u64]);", "overflowing_literals"]
	];
	const rejected = [];
	for(const [name, statement, code] of negatives)
	{
		const source = `use lists_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const failure = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(failure.code, 101, failure.stderr);
		const diagnostics = failure.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), failure.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const shape = field => projection.surface.copy(projection.surface.functions.find(fn => fn.field === field).declaration.result.type);
	const list = shape("reverse_uint32"), nested = shape("mix"), inner = nested.element;
	const malformed = `
#[cfg(test)] mod list_layout {
    use super::*;
    #[test] fn invalid_list_layouts_reject_before_reading_memory() {
        for (data, length) in [(std::ptr::null(), 1), (1usize as *const u32, 1), (std::ptr::dangling::<u32>(), usize::MAX)] {
            let value = ${list.ctype} { data, length, ..Default::default() };
            assert!(matches!(from${list.index}(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        }
        let empty = ${list.ctype} { data: std::ptr::dangling(), length: 0, ..Default::default() };
        assert_eq!(from${list.index}(&empty, &mut Scope::new()).unwrap(), Vec::<u32>::new());
        let children = [${inner.ctype}::default(), ${inner.ctype} { length: 1, ..Default::default() }];
        let value = ${nested.ctype} { data: children.as_ptr(), length: children.len(), ..Default::default() };
        assert!(matches!(from${nested.index}(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        let valid = [42u32];
        let value = ${list.ctype} { data: valid.as_ptr(), length: 1, ..Default::default() };
        let mut scope = Scope::new(); scope.remaining = 0;
        assert!(matches!(from${list.index}(&value, &mut scope), Err(Error::Limit)));
        assert_eq!(crate::reverse_uint32(&[1, 2, 3]).unwrap(), vec![3, 2, 1]);
    }
}
`;
	const runtimePath = join(installed, "src/__runtime.rs"), original = await readFile(runtimePath, "utf8");
	const faults = await readFile("tests/fixtures/list-consumers/rust-faults.rs", "utf8");
	await saveLakeFile(installed, "src/__runtime.rs", `${original}\n${faults}\n${malformed}`);
	const checked = await runCopied(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--lib", "--manifest-path", join(installed, "Cargo.toml"), "--", "--test-threads=1", "--nocapture"], root, env);
	assert.match(checked.stdout, /2 passed; 0 failed/);
	const faultChecks = Number(checked.stdout.match(/list-faults:(\d+)/)?.[1]); assert.ok(faultChecks > 200);
	await saveLakeFile(installed, "src/__runtime.rs", original);
	const executable = join(consumer, "relocated-consumer");
	await cp(command, executable);
	await rm(root, { recursive: true, force: true });
	const executed = await runCopied(executable, [], consumer);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^list-rust-ok:\d+\n$/);
	return { rejected, faultTests: 2, faultChecks, faultSourceSha256: sha256(faults), malformedSourceSha256: sha256(malformed), executableSha256: sha256(await readFile(executable)), sourceFreeChecks: Number(executed.stdout.trim().split(":")[1]) };
};

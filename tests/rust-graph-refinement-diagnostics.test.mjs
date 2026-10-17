/**
 * Exact checked-refinement diagnostics through recursive Rust graph crates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	generateCopiedRustGraphPackage
} from "../src/backends/rust/copied-graph-package.mjs";
import { copiedRustLock } from "../src/backends/rust/copied-values.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { mutualCheckedRecordReview } from "./helpers/mutual-checked-record-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { recursiveCheckedRecordReview } from "./helpers/recursive-checked-record-fixture.mjs";
import "./helpers/rust-graph-diagnostic-source-history-tests.mjs";

const runtime = "src/__runtime.rs";

test("Rust graph diagnostics are explicit and leave other crates byte-identical", () => {
	for(const ir of [nativeRecursiveReviewedIr(), recursiveCheckedRecordReview()])
	{
		const before = structuredClone(ir), files = generateCopiedRustGraphPackage(ir);
		assert.deepEqual(generateCopiedRustGraphPackage(ir, null, {}
			, { refinementDiagnostics: false }), files);
		assert.deepEqual(ir, before);
		for(const text of Object.values(files))
			assert.doesNotMatch(text, /_graph_error|diagnostic:|graph_checked_error/u);
	}
	for(const value of [0, 1, "true", null])
		assert.throws(() => generateCopiedRustGraphPackage(
			mutualCheckedRecordReview(), null, {}
			, { refinementDiagnostics: value }
		), /must be explicit/u);
});

test("Rust graph diagnostics bind one reader and route every native call", () => {
	const ir = mutualCheckedRecordReview();
	const off = generateCopiedRustGraphPackage(ir);
	const on = generateCopiedRustGraphPackage(ir, null, {}
		, { refinementDiagnostics: true });
	assert.deepEqual(Object.keys(on), Object.keys(off));
	for(const path of Object.keys(off).filter(path => path !== runtime))
		assert.equal(on[path], off[path], path);
	const source = on[runtime];
	assert.equal(source.match(/symbol!\("mutualcheckedrecords_graph_error"/gu).length, 1);
	assert.match(source, /diagnostic: unsafe extern "C" fn\(\) -> \*const std::ffi::c_char/u);
	assert.match(source, /std::ffi::CStr::from_ptr\(pointer\) \}\.to_str\(\)/u);
	assert.match(source, /Err\(_\) => Error::InvalidNative/u);
	const calls = source.match(/\.map_err\(\|error\| graph_checked_error\(error, runtime\.diagnostic\)\)/gu);
	assert.equal(calls.length, ir.declarations.length);
});

test("Rust graph diagnostics compile and preserve exact UTF-8 errors", {
	skip: process.env.LEAN_BRIDGE_RUST_GRAPH_DIAGNOSTIC_TEST !== "1"
	, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-graph-diagnostic-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedRustGraphPackage(recursiveCheckedRecordReview(), null
		, {}, { refinementDiagnostics: true });
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "Cargo.lock", await copiedRustLock(
		"lean_bridge_recursivecheckedrecords", "1.0.0"
	));
	await saveLakeFile(root, runtime, files[runtime] + `
#[cfg(test)] mod diagnostic_tests {
    use super::*;
    static EXACT: &[u8] = b"arg0.tail?.value was rejected by RecursiveCheckedRecords.plusOne\\0";
    static MALFORMED: &[u8] = &[0xff, 0];
    static READS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    unsafe extern "C" fn exact() -> *const std::ffi::c_char { EXACT.as_ptr().cast() }
    unsafe extern "C" fn missing() -> *const std::ffi::c_char { std::ptr::null() }
    unsafe extern "C" fn malformed() -> *const std::ffi::c_char { MALFORMED.as_ptr().cast() }
    unsafe extern "C" fn counted() -> *const std::ffi::c_char {
        READS.fetch_add(1, std::sync::atomic::Ordering::Relaxed); std::ptr::null()
    }
    #[test] fn exact_checked_errors_are_one_shot_and_fail_closed() {
        assert_eq!(graph_checked_error(GraphError::InvalidInput, exact), Error::Native {
            code: 1, message: "arg0.tail?.value was rejected by RecursiveCheckedRecords.plusOne".into()
        });
        assert_eq!(graph_checked_error(GraphError::InvalidInput, missing), graph_error(GraphError::InvalidInput));
        assert_eq!(graph_checked_error(GraphError::InvalidInput, malformed), Error::InvalidNative);
        assert_eq!(graph_checked_error(GraphError::Limit, counted), Error::Limit);
        assert_eq!(READS.load(std::sync::atomic::Ordering::Relaxed), 0);
    }
}
`);
	const environment = nativeFixtureEnvironment(["rust"]), env = { ...environment
		, RUSTC: environment.LEAN_BRIDGE_RUSTC, RUSTFLAGS: "-Dwarnings"
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_TARGET_DIR: join(root, "target") };
	const result = await runCopied(environment.LEAN_BRIDGE_CARGO
		, ["test", "--locked", "--offline", "--lib"], root, env);
	assert.match(result.stdout, /1 passed; 0 failed/u);
});

test("Cargo generation and packaging select diagnostics from the shared adapter rule", async () => {
	const projection = await readFile("src/build/native-rust-projection.mjs", "utf8");
	const release = await readFile("src/release/native-cargo.mjs", "utf8");
	for(const source of [projection, release])
	{
		assert.match(source, /generate === generateCopiedRustGraphPackage/u);
		assert.match(source, /refinementDiagnostics: nativeGraphRefinementDiagnostics\(model\)/u);
		assert.match(source, /\.\.\.options/u);
	}
});

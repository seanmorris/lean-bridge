/**
 * Exercise recursive checked-record Rust CI admission with synthetic control transcripts.
 * These controls do not substitute for original installed package executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { recursiveCheckedRecordRustCiTestName, parseRecursiveCheckedRecordRustCiArgs, assertRecursiveCheckedRecordRustCiTap, checkRecursiveCheckedRecordRustCiRecords, recursiveCheckedRecordRustCiReader } from "./recursive-checked-record-rust-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const options = { route: "ordinary", fixture: "recursive", producer: "a".repeat(40), directory: "synthetic-records", tap: "synthetic.tap", glibc: "2.38", rustc: "/runtime/rustc", cargo: "/runtime/cargo" };
const syntheticTap = (route, fixture) => {
	const name = recursiveCheckedRecordRustCiTestName(route, fixture);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
};

test("recursive checked-record Rust CI refuses unknown, duplicate and incomplete selections", () => {
	const args = argsOf(options); assert.deepEqual(parseRecursiveCheckedRecordRustCiArgs(args), options);
	assert.deepEqual(parseRecursiveCheckedRecordRustCiArgs(argsOf({ ...options, glibc: "2.36" })), { ...options, glibc: "2.36" });
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseRecursiveCheckedRecordRustCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseRecursiveCheckedRecordRustCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", null, true])
			assert.throws(() => parseRecursiveCheckedRecordRustCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }
		, { fixture: "recursive,mutual" }
		, { route: "unknown" }, { fixture: "unknown" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }, { unknown: "value" }
		, { rustc: "rustc" }, { cargo: "cargo" }
		, { rustc: "/runtime/rustc\n" }
		, { rustc: "/runtime/../rustc" }, { cargo: "/runtime/../cargo" }
		, { cargo: "/runtime/rustc" }])
		assert.throws(() => parseRecursiveCheckedRecordRustCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseRecursiveCheckedRecordRustCiArgs(invalid));
});

test("recursive checked-record Rust CI refuses incomplete or false successful-looking TAP", t => {
	let controls = 0;
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const tap = syntheticTap(route, fixture);
		assertRecursiveCheckedRecordRustCiTap(tap, route, fixture);
		const changed = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n", tap + "# SKIP excluded\n"
			, tap + "# TODO later\n", tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n"), tap + "1..1\n"
			, tap.replace("# Subtest:", "# Wrong:"), tap + "ok 2 - unrelated\n"
			, tap + tap
			, ...Object.keys({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }).flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changed)
		{
			assert.notEqual(source, tap);
			assert.throws(() => assertRecursiveCheckedRecordRustCiTap(source, route, fixture)); controls++;
		}
		assert.throws(() => assertRecursiveCheckedRecordRustCiTap(tap, route === "ordinary" ? "reviewed" : "ordinary", fixture));
		assert.throws(() => assertRecursiveCheckedRecordRustCiTap(tap, route
			, fixture === "recursive" ? "mutual" : "recursive")); controls += 2;
	}
	assert.equal(controls, 140);
	t.diagnostic("140 synthetic incomplete, mismatched, skipped or failed TAP controls; no installed execution claimed.");
});

test("recursive checked-record Rust CI rejects bad scope and substituted tools before reading records", async () => {
	const runtime = { platform: "linux", arch: "x64", glibc: "2.38" };
	const versions = { rustc: "rustc 1.90.0 (1159e78c4 2025-09-14)\n"
		, cargo: "cargo 1.90.0 (840b83a10 2025-07-30)\n" };
	const toolchain = {};
	for(const [name, stdout] of Object.entries(versions))
	{
		const run = { code: 0, stderr: "", stdout };
		toolchain[name] = { command: options[name], bytes: 1, sha256: "a".repeat(64), run };
	}
	const sentinel = new Error("Original installed package records are required");
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const selected = { ...options, route, fixture }, tap = syntheticTap(route, fixture), reads = [];
		const read = async path => { reads.push(path); throw sentinel; };
		await assert.rejects(checkRecursiveCheckedRecordRustCiRecords({ ...selected, producer: "HEAD" }, { tap, read, runtime, toolchain }), assert.AssertionError);
		await assert.rejects(checkRecursiveCheckedRecordRustCiRecords(selected, { tap: tap.replace("# skipped 0", "# skipped 1"), read, runtime, toolchain }), assert.AssertionError);
		await assert.rejects(checkRecursiveCheckedRecordRustCiRecords(selected, { tap, read, runtime: { ...runtime, arch: "arm64" }, toolchain }), assert.AssertionError);
		for(const name of ["rustc", "cargo"])
			for(const change of [tool => { tool.command += "-substituted"; }, tool => { tool.run.stdout += "changed"; }, tool => { tool.run.code = 1; }])
			{
				const changed = structuredClone(toolchain); change(changed[name]);
				await assert.rejects(checkRecursiveCheckedRecordRustCiRecords(selected, { tap, read, runtime, toolchain: changed }), assert.AssertionError);
			}
		assert.deepEqual(reads, []);
		await assert.rejects(checkRecursiveCheckedRecordRustCiRecords(selected, { tap, read, runtime, toolchain }), error => error === sentinel);
		assert.deepEqual(reads, ["report.json"]);
	}
});

test("recursive checked-record Rust CI reader requires original retained dependency manifests", async () => {
	const source = Buffer.from("synthetic dependency"), checksum = sha256("synthetic registry archive");
	const manifest = Buffer.from(canonicalJson({ files: { "Cargo.toml": sha256(source) }, package: checksum }));
	const files = [["Cargo.toml", source], [".cargo-checksum.json", manifest]].map(([path, bytes]) => ({
		path: "dependencies/synthetic-1.0.0/" + path, bytes, mode: 0o644
	}));
	const archive = createDeterministicTarGzFromFiles({ files, sourceDateEpoch: 1 });
	const dependencies = { sha256: sha256(archive), packages: [{ directory: "synthetic-1.0.0", checksum, files: 1, manifestSha256: sha256(manifest) }] };
	const originals = new Map([["dependencies.json", Buffer.from(canonicalJson(dependencies))]
		, ["dependency-handoff/rust-dependencies.tar.gz", archive]
		, ["dependency-manifests/synthetic-1.0.0.json", manifest]]);
	const reader = values => async path => { assert.ok(values.has(path), path); return Buffer.from(values.get(path)); };
	const read = reader(originals); assert.equal(await recursiveCheckedRecordRustCiReader(read), read);
	for(const path of originals.keys())
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(recursiveCheckedRecordRustCiReader(reader(missing)));
		const changed = new Map(originals); changed.set(path, Buffer.concat([originals.get(path), Buffer.from("changed")]));
		await assert.rejects(recursiveCheckedRecordRustCiReader(reader(changed)));
	}
});

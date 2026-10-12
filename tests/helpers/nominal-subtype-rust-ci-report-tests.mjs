/**
 * Check the recurring nominal Rust gate against original executions and false selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseNominalSubtypeRustCiArgs, assertNominalSubtypeRustCiTap, checkNominalSubtypeRustCiRecords } from "./nominal-subtype-rust-ci-report.mjs";

const root = "docs/evidence/nominal-subtype-rust-20261012";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const optionsFor = run => ({ route: run.route
	, mode: run.mode, producer: run.producerCommit
	, directory: `${root}/${run.label}/records`
	, tap: `${root}/${run.label}/run.tap`
	, glibc: run.floor, rustc: run.toolchain.rustc.command
	, cargo: run.toolchain.cargo.command });
const originals = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "8fc801f8f1e6e1af7c4e6844ded44a46b700702b11ba979071cef0b194ae5495");
	const index = JSON.parse(bytes), files = new Map();
	for(const file of index.files)
	{
		const value = await readFile(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("nominal Rust CI rejects unknown, duplicate and incomplete selections", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", glibc: "2.38", rustc: "/runtime/rustc", cargo: "/runtime/cargo" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeRustCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypeRustCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypeRustCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value"])
			assert.throws(() => parseNominalSubtypeRustCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }
		, { mode: "full,result-only" }
		, { route: "unknown" }
		, { mode: "unknown" }
		, { producer: "a".repeat(39) }
		, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }
		, { rustc: "rustc" }, { cargo: "cargo" }, { cargo: "/runtime/rustc" }
		, { rustc: "/runtime/rustc\n" }, { cargo: "/runtime/cargo\n" }
		, { unknown: "value" }])
		assert.throws(() => parseNominalSubtypeRustCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypeRustCiArgs(invalid));
});

test("nominal Rust CI requires complete zero-skip TAP for each exact installed selection", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = files.get(`${run.label}/run.tap`).toString();
		assertNominalSubtypeRustCiTap(tap, run.route, run.mode);
		const changed = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -")
			, tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n"
			, tap + "# SKIP excluded\n"
			, tap + "# TODO later\n"
			, tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n")
			, tap + "1..1\n", tap.replace("# Subtest:", "# Wrong:")
			, tap + "ok 2 - unrelated\n", tap + tap
			, tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...Object.keys({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }).flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changed)
		{
			assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypeRustCiTap(source, run.route, run.mode)); controls++;
		}
		assert.throws(() => assertNominalSubtypeRustCiTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypeRustCiTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});

test("nominal Rust CI authenticates all original records and binds producer, runtime and API", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const options = optionsFor(run), prefix = `${run.label}/records/`;
		const input = { tap: files.get(`${run.label}/run.tap`).toString()
			, runtime: run.runtime
			, toolchain: run.toolchain
			, read: async path => { assert.ok(files.has(prefix + path), path); return files.get(prefix + path); } };
		const result = await checkNominalSubtypeRustCiRecords(options, input);
		assert.equal(result.executions, 3); assert.equal(result.dispatchObserved, false);
		assert.deepEqual(result.toolchain, run.toolchain);
		for(const name of ["rustc", "cargo"])
		{
			await assert.rejects(checkNominalSubtypeRustCiRecords({ ...options, [name]: `/different/${name}` }, input)); controls++;
			const changes = [tool => { tool.sha256 = "0".repeat(64); }
				, tool => { tool.bytes++; }
				, tool => { tool.run.stdout = tool.run.stdout.replace("1.90.0", "1.91.0"); }];
			for(const change of changes)
			{
				const toolchain = structuredClone(input.toolchain); change(toolchain[name]);
				await assert.rejects(checkNominalSubtypeRustCiRecords(options, { ...input, toolchain })); controls++;
			}
		}
		for(const changed of [{ producer: "0".repeat(40) }, { glibc: "2.38" }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }]) {
			await assert.rejects(checkNominalSubtypeRustCiRecords({ ...options, ...changed }, input)); controls++;
			}
		for(const runtime of [{ ...run.runtime, arch: "arm64" }, { ...run.runtime, platform: "win32" }, { ...run.runtime, glibc: "2.39" }])
		{ await assert.rejects(checkNominalSubtypeRustCiRecords(options, { ...input, runtime })); controls++; }
		const original = JSON.parse(await input.read("report.json"));
		for(const mutate of [report => { report.observations.pop(); }
			, report => { report.installation.tools.rustc.sha256 = "0".repeat(64); }
			, report => { report.offlineInstall = false; }
			, report => { report.reproducible = false; }
			, report => { report.observations[0].counts.checks = 1; }
			, report => { report.sourceRemovedBeforeInstallation = false; }]) {
			const changed = structuredClone(original); mutate(changed);
			await assert.rejects(checkNominalSubtypeRustCiRecords(options, { ...input
				, read: path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : input.read(path) })); controls++;
			}
		await assert.rejects(checkNominalSubtypeRustCiRecords(options, { ...input, read: path => {
			if(path === "relocated.json") throw new Error("missing replay");
			return input.read(path);
		} })); controls++;
	}
	t.diagnostic(`${controls} producer, runtime, complete API and original record controls`);
});

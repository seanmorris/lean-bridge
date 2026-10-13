/**
 * Check recurring WIT verification against authenticated original execution records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertNominalSubtypeWitCiTap, checkNominalSubtypeWitCiRecords, parseNominalSubtypeWitCiArgs } from "./nominal-subtype-wit-ci-report.mjs";

const root = "docs/evidence/nominal-subtype-wit-20261013";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originals = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "760dc281a804a238af123a2b1e1a4d5f3acdbacf6598b6518fb2922fcfec2e2e");
	const index = JSON.parse(bytes), files = new Map();
	for(const file of index.files)
	{
		const value = await readFile(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256); files.set(file.path, value);
	}
	return { index, files };
};
const selection = (files, run) => {
	const prefix = `${run.label}/records/`;
	const read = async path => { assert.ok(files.has(prefix + path), path); return files.get(prefix + path); };
	const tools = JSON.parse(files.get(prefix + "tools.json"));
	const options = { route: run.route
		, mode: run.mode
		, producer: run.producerCommit
		, directory: `${root}/${run.label}/records`
		, tap: `${root}/${run.label}/run.tap`
		, glibc: run.floor, cc: tools.selected.cc
		, "wasm-tools": tools.selected.wasmTools
		, "wasmtime-capi": tools.selected.wasmtimeCapi };
	const input = { tap: files.get(`${run.label}/run.tap`).toString(), read
		, runtime: run.runtime, tools, archiveSha256: run.archiveSha256 };
	return { options, input };
};

test("nominal WIT CI rejects unknown, repeated and incomplete selections", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", glibc: "2.38"
		, cc: "/selected/cc"
		, "wasm-tools": "/selected/wasm-tools"
		, "wasmtime-capi": "/selected/capi" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeWitCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypeWitCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypeWitCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNominalSubtypeWitCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [{ route: "ordinary,reviewed" }
		, { mode: "full,result-only" }
		, { route: "unknown" }, { mode: "unknown" }, { producer: "a".repeat(39) }
		, { producer: "G".repeat(40) }, { glibc: "2.35" }, { glibc: "2.39" }
		, { cc: "cc" }
		, { "wasm-tools": "wasm-tools" }
		, { "wasmtime-capi": "capi" }
		, { unknown: "value" }])
		assert.throws(() => parseNominalSubtypeWitCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypeWitCiArgs(invalid));
});

test("nominal WIT CI requires complete zero-skip TAP for each exact selection", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = files.get(`${run.label}/run.tap`).toString(); assertNominalSubtypeWitCiTap(tap, run.route, run.mode);
		const changes = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n"
			, tap + "# SKIP excluded\n"
			, tap + "# TODO later\n"
			, tap.replace("1..1\n", ""), tap.replace("1..1\n", "1..2\n"), tap + "1..1\n"
			, tap.replace("# Subtest:", "# Wrong:")
			, tap + "ok 2 - unrelated\n"
			, tap + tap
			, tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"]
				.map(line => tap.replace("\n1..1\n", `\n    ${line}\n1..1\n`))
			, ...["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changes)
		{ assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypeWitCiTap(source, run.route, run.mode)); controls++; }
		assert.throws(() => assertNominalSubtypeWitCiTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypeWitCiTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 164); t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});

test("nominal WIT CI binds package records to exact current tool, runtime and archive facts", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const { options, input } = selection(files, run), result = await checkNominalSubtypeWitCiRecords(options, input);
		assert.equal(result.executions, 2); assert.deepEqual(result.tools, input.tools);
		assert.equal(result.standaloneWasi, false); assert.equal(result.nativeHostRequired, true);
		for(const change of [value => { value.commands.cc.command = "/different/cc"; }
			, value => { value.commands.wasmTools.sha256 = "0".repeat(64); }
			, value => { value.selected.cc = "/different/cc"; }
			, value => { value.selected.wasmTools = "/different/wasm-tools"; }
			, value => { value.selected.wasmtimeCapi = "/different/capi"; }
			, value => { value.wasmtime.version = "42.0.2"; }
			, value => { value.wasmtime.files["lib/libwasmtime.so"].sha256 = "0".repeat(64); }
			, value => { delete value.commands.tar; }
			, value => { value.versions.cc.args.push("--other"); }
			, value => { value.commands.extra = value.commands.cc; }
		]) {
			const tools = structuredClone(input.tools); change(tools);
			await assert.rejects(checkNominalSubtypeWitCiRecords(options, { ...input, tools })); controls++;
		}
		for(const changed of [{ producer: "0".repeat(40) }, { glibc: "2.38" }
			, { cc: "/different/cc" }
			, { "wasm-tools": "/different/wasm-tools" }
			, { "wasmtime-capi": "/different/capi" }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }
		]) {
			await assert.rejects(checkNominalSubtypeWitCiRecords({ ...options, ...changed }, input)); controls++;
		}
		for(const runtime of [{ ...run.runtime, arch: "arm64" }, { ...run.runtime, platform: "win32" }, { ...run.runtime, glibc: "2.39" }])
		{ await assert.rejects(checkNominalSubtypeWitCiRecords(options, { ...input, runtime })); controls++; }
		await assert.rejects(checkNominalSubtypeWitCiRecords(options, { ...input, archiveSha256: "0".repeat(64) })); controls++;
		const original = JSON.parse(await input.read("report.json"));
		for(const change of [value => { value.observations.pop(); }
			, value => { value.offlineInstall = false; }
			, value => { value.sourceRemovedBeforeInstallation = false; }
			, value => { value.reproducible = false; }
			, value => { value.callerSourceRemovedBeforeExecution = false; }
			, value => { value.compilerFreeReplay = false; }
			, value => { value.componentModel.standaloneWasi = true; }
			, value => { value.observations[0].run.code = 1; }
		]) {
			const changed = structuredClone(original); change(changed);
			await assert.rejects(checkNominalSubtypeWitCiRecords(options, { ...input
				, read: path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : input.read(path) })); controls++;
		}
		for(const missing of ["tools.json", "tools-after.json", "build-1/model.json", "relocated.json", "runtime.json", "installation.json", "package/component/nominalsubtypes.wasm"])
		{
			await assert.rejects(checkNominalSubtypeWitCiRecords(options, { ...input, read: path => {
				if(path === missing) throw new Error("missing original"); return input.read(path);
			} })); controls++;
		}
	}
	assert.equal(controls, 144); t.diagnostic(`${controls} selected tool, original package and complete record controls`);
});

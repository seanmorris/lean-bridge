/**
 * Check the recurring nominal C# gate against original executions and false selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseNominalSubtypeDotnetCiArgs, assertNominalSubtypeDotnetCiTap, checkNominalSubtypeDotnetCiRecords } from "./nominal-subtype-dotnet-ci-report.mjs";

const root = "docs/evidence/nominal-subtype-dotnet-20261012";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const optionsFor = run => ({ route: run.route
	, mode: run.mode, producer: run.producerCommit
	, directory: `${root}/${run.label}/records`
	, tap: `${root}/${run.label}/run.tap`
	, glibc: run.floor, dotnet: run.toolchain.command });
const originals = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "57f0400fec21849c9e29be1a98029a20808bfd3c9532a904370444d9c7b1cb38");
	const index = JSON.parse(bytes), files = new Map();
	for(const file of index.files)
	{
		const value = await readFile(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("nominal C# CI rejects unknown, duplicate and incomplete selections", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", glibc: "2.38", dotnet: "/runtime/dotnet" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeDotnetCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypeDotnetCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypeDotnetCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value"])
			assert.throws(() => parseNominalSubtypeDotnetCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }
		, { mode: "full,result-only" }
		, { route: "unknown" }
		, { mode: "unknown" }
		, { producer: "a".repeat(39) }
		, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }
		, { dotnet: "dotnet" }
		, { dotnet: "/runtime/dotnet\n" }
		, { unknown: "value" }])
		assert.throws(() => parseNominalSubtypeDotnetCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypeDotnetCiArgs(invalid));
});

test("nominal C# CI requires complete zero-skip TAP for each exact installed selection", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = files.get(`${run.label}/run.tap`).toString();
		assertNominalSubtypeDotnetCiTap(tap, run.route, run.mode);
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
			assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypeDotnetCiTap(source, run.route, run.mode)); controls++;
		}
		assert.throws(() => assertNominalSubtypeDotnetCiTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypeDotnetCiTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});

test("nominal C# CI authenticates all original records and binds host, framework and API", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const options = optionsFor(run), prefix = `${run.label}/records/`;
		const input = { tap: files.get(`${run.label}/run.tap`).toString()
			, runtime: run.runtime, toolchain: run.toolchain, framework: run.framework
			, archiveSha512: run.archiveSha512
			, read: async path => { assert.ok(files.has(prefix + path), path); return files.get(prefix + path); } };
		const result = await checkNominalSubtypeDotnetCiRecords(options, input);
		assert.equal(result.executions, 3); assert.equal(result.dispatchObserved, false);
		assert.deepEqual(result.toolchain, run.toolchain);
		assert.deepEqual(result.framework, run.framework);
		const toolChanges = [tool => { tool.command = "/different/dotnet"; }
			, tool => { tool.interpreter.sha256 = "0".repeat(64); }
			, tool => { tool.interpreter.bytes++; }
			, tool => { tool.sdk.version = "8.0.425"; }
			, tool => { tool.sdk.directory = "/different/sdk"; }];
		for(const change of toolChanges)
		{
			const toolchain = structuredClone(input.toolchain); change(toolchain);
			await assert.rejects(checkNominalSubtypeDotnetCiRecords(options, { ...input, toolchain })); controls++;
		}
		const frameworkChanges = [value => { value.facts.version = "8.0.31"; }
			, value => { value.facts.command = "/different/dotnet"; }
			, value => { value.facts.directory = "/different/framework/"; }
			, value => { value.facts.architecture = "Arm64"; }
			, value => { value.runtimeFiles["libcoreclr.so"].sha256 = "0".repeat(64); }
			, value => { value.runtimeFiles["System.Private.CoreLib.dll"].bytes++; }];
		for(const change of frameworkChanges)
		{
			const framework = structuredClone(input.framework); change(framework);
			await assert.rejects(checkNominalSubtypeDotnetCiRecords(options, { ...input, framework })); controls++;
		}
		const optionsChanges = [{ producer: "0".repeat(40) }, { glibc: "2.38" }
			, { dotnet: "/different/dotnet" }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }];
		for(const changed of optionsChanges)
		{
			await assert.rejects(checkNominalSubtypeDotnetCiRecords({ ...options, ...changed }, input)); controls++;
		}
		for(const runtime of [{ ...run.runtime, arch: "arm64" }, { ...run.runtime, platform: "win32" }, { ...run.runtime, glibc: "2.39" }])
		{ await assert.rejects(checkNominalSubtypeDotnetCiRecords(options, { ...input, runtime })); controls++; }
		await assert.rejects(checkNominalSubtypeDotnetCiRecords(options, { ...input, archiveSha512: "A".repeat(86) + "==" })); controls++;
		const original = JSON.parse(await input.read("report.json"));
		const changes = [value => { value.observations.pop(); }
			, value => { value.tools.interpreter.sha256 = "0".repeat(64); }
			, value => { value.offlineInstall = false; }
			, value => { value.reproducible = false; }
			, value => { value.observations[0].counts.checks = 1; }
			, value => { value.sourceRemovedBeforeInstallation = false; }];
		for(const mutate of changes)
		{
			const changed = structuredClone(original); mutate(changed);
			await assert.rejects(checkNominalSubtypeDotnetCiRecords(options, { ...input
				, read: path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : input.read(path) })); controls++;
		}
		await assert.rejects(checkNominalSubtypeDotnetCiRecords(options, { ...input, read: path => {
			if(path === "relocated.json") throw new Error("missing replay");
			return input.read(path);
		} })); controls++;
	}
	t.diagnostic(`${controls} producer, host, framework, original archive and complete record controls`);
});

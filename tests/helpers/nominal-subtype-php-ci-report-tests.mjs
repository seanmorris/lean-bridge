/**
 * Test recurring PHP checks against authenticated original execution records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertNominalSubtypePhpCiTap, checkNominalSubtypePhpCiRecords, parseNominalSubtypePhpCiArgs } from "./nominal-subtype-php-ci-report.mjs";

const root = "docs/evidence/nominal-subtype-php-20261013";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originals = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "9f22ebf9f08e25f38b909690a6bc27b024f161b339eb98c6c2200e4c4039c2c2");
	const index = JSON.parse(bytes), files = new Map();
	for(const file of index.files)
	{
		const value = await readFile(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};
const selection = (files, run) => {
	const prefix = `${run.label}/records/`;
	const read = async path => { assert.ok(files.has(prefix + path), path); return files.get(prefix + path); };
	const tools = JSON.parse(files.get(prefix + "tools.json"));
	const options = { route: run.route, mode: run.mode
		, producer: run.producerCommit
		, directory: `${root}/${run.label}/records`
		, tap: `${root}/${run.label}/run.tap`
		, glibc: run.floor, php: tools.selected.php
		, composer: tools.selected.composer
		, "php-version": tools.selected.phpVersion
		, "composer-version": tools.selected.composerVersion };
	const input = { tap: files.get(`${run.label}/run.tap`).toString(), read
		, runtime: run.runtime, tools, archiveSha256: run.archiveSha256 };
	return { options, input };
};

test("nominal PHP CI rejects unknown, repeated and incomplete selections", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", glibc: "2.38"
		, php: "/selected/php", composer: "/selected/composer"
		, "php-version": "8.2.33", "composer-version": "2.5.5" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypePhpCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypePhpCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypePhpCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNominalSubtypePhpCiArgs(argsOf({ ...options, [key]: value })));
	}
	const changes = [{ route: "ordinary,reviewed" }, { mode: "full,result-only" }
		, { route: "unknown" }, { mode: "unknown" }, { producer: "a".repeat(39) }
		, { producer: "G".repeat(40) }, { glibc: "2.35" }, { glibc: "2.39" }
		, { php: "php" }, { composer: "composer" }, { unknown: "value" }
		, ...["8.1.33", "9.0.0", "8.2.33-dev", "8.2"].map(value => ({ "php-version": value }))
		, ...["1.0.0", "3.0.0", "2.5.5-dev", "2.5"].map(value => ({ "composer-version": value }))];
	for(const changed of changes) assert.throws(() => parseNominalSubtypePhpCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypePhpCiArgs(invalid));
});

test("nominal PHP CI requires complete zero-skip TAP for each exact selection", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = files.get(`${run.label}/run.tap`).toString();
		assertNominalSubtypePhpCiTap(tap, run.route, run.mode);
		const changes = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -")
			, tap.replace("ok 1 -", "ok 2 -"), tap + "Bail out! stopped\n"
			, tap + "# SKIP excluded\n", tap + "# TODO later\n"
			, tap.replace("1..1\n", ""), tap.replace("1..1\n", "1..2\n")
			, tap + "1..1\n", tap.replace("# Subtest:", "# Wrong:")
			, tap + "ok 2 - unrelated\n", tap + tap, tap + "incomplete\n"
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
		{
			assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypePhpCiTap(source, run.route, run.mode)); controls++;
		}
		assert.throws(() => assertNominalSubtypePhpCiTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypePhpCiTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});

test("nominal PHP CI binds original records to exact selected tools, versions and Composer ZIP", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const { options, input } = selection(files, run);
		const result = await checkNominalSubtypePhpCiRecords(options, input);
		assert.equal(result.executions, 4); assert.deepEqual(result.tools, input.tools);
		// The archived selection is /usr/bin/php, while its measured target is php8.2.
		// A reader must not rewrite the selected alias or reopen historical tool paths.
		assert.notEqual(input.tools.selected.php, input.tools.command);
		const toolChanges = [value => { value.command = "/different/php"; }
			, value => { value.composer = "/different/composer"; }
			, value => { value.selected.php = value.command; }
			, value => { value.selected.phpVersion = "8.2.34"; }
			, value => { value.selected.composerVersion = "2.5.6"; }
			, value => { value.interpreter.php.version = "8.2.34"; }
			, value => { value.runtimeFlags.pop(); }
			, value => { value.tools[value.command].sha256 = "0".repeat(64); }
			, value => { delete value.tools[value.composer]; }
			, value => { value.tools["/extra/tool"] = { bytes: 1, sha256: "0".repeat(64) }; }];
		for(const change of toolChanges)
		{
			const tools = structuredClone(input.tools); change(tools);
			await assert.rejects(checkNominalSubtypePhpCiRecords(options, { ...input, tools })); controls++;
		}
		const optionChanges = [{ producer: "0".repeat(40) }
			, { glibc: "2.38" }, { php: input.tools.command }
			, { composer: "/different/composer" }, { "php-version": "8.2.34" }
			, { "composer-version": "2.5.6" }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }];
		for(const changed of optionChanges)
		{ await assert.rejects(checkNominalSubtypePhpCiRecords({ ...options, ...changed }, input)); controls++; }
		for(const runtime of [{ ...run.runtime, arch: "arm64" }, { ...run.runtime, platform: "win32" }, { ...run.runtime, glibc: "2.39" }])
		{ await assert.rejects(checkNominalSubtypePhpCiRecords(options, { ...input, runtime })); controls++; }
		await assert.rejects(checkNominalSubtypePhpCiRecords(options, { ...input, archiveSha256: "0".repeat(64) })); controls++;
		const original = JSON.parse(await input.read("report.json"));
		const reportChanges = [value => { value.observations.pop(); }
			, value => { value.offlineInstall = false; }
			, value => { value.sourceRemovedBeforeInstallation = false; }
			, value => { value.reproducible = false; }
			, value => { value.consumerSourceRequired = false; }
			, value => { value.compilerFreeReplay = false; }
			, value => { value.dispatch.observed = true; }
			, value => { value.observations[0].run.code = 1; }];
		for(const change of reportChanges)
		{
			const changed = structuredClone(original); change(changed);
			await assert.rejects(checkNominalSubtypePhpCiRecords(options, { ...input
				, read: path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : input.read(path) })); controls++;
		}
		for(const missing of ["tools.json", "build-1/model.json", "relocated-strict.json", "runtime.json", "environment.json"])
		{
			await assert.rejects(checkNominalSubtypePhpCiRecords(options, { ...input, read: path => {
				if(path === missing) throw new Error("missing original"); return input.read(path);
			} })); controls++;
		}
	}
	t.diagnostic(`${controls} selected tool, original package and complete record controls`);
});

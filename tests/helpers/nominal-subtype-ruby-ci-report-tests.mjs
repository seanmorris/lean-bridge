/**
 * Check the recurring nominal Ruby gate against original executions and false selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseNominalSubtypeRubyCiArgs, assertNominalSubtypeRubyCiTap, checkNominalSubtypeRubyCiRecords } from "./nominal-subtype-ruby-ci-report.mjs";

const root = "docs/evidence/nominal-subtype-ruby-20261012";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const optionsFor = run => ({ route: run.route
	, mode: run.mode, producer: run.producerCommit
	, directory: `${root}/${run.label}/records`
	, tap: `${root}/${run.label}/run.tap`
	, glibc: run.floor, ruby: "/app/.toolchains/ruby33/bin/ruby" });
const originals = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "385e4ceab16932cc433346fb5763e2c2d3e3da2138377383da1899a3ac84c670");
	const index = JSON.parse(bytes), files = new Map();
	for(const file of index.files)
	{
		const value = await readFile(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("nominal Ruby CI rejects unknown, duplicate and incomplete selections", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", glibc: "2.38", ruby: "/runtime/ruby" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeRubyCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypeRubyCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypeRubyCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value"])
			assert.throws(() => parseNominalSubtypeRubyCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }
		, { mode: "full,result-only" }
		, { route: "unknown" }
		, { mode: "unknown" }
		, { producer: "a".repeat(39) }
		, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }, { ruby: "ruby" }
		, { ruby: "/runtime/ruby\n" }, { unknown: "value" }])
		assert.throws(() => parseNominalSubtypeRubyCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypeRubyCiArgs(invalid));
});

test("nominal Ruby CI requires complete zero-skip TAP for each exact installed selection", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = files.get(`${run.label}/run.tap`).toString();
		assertNominalSubtypeRubyCiTap(tap, run.route, run.mode);
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
			assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypeRubyCiTap(source, run.route, run.mode)); controls++;
		}
		assert.throws(() => assertNominalSubtypeRubyCiTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypeRubyCiTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});

test("nominal Ruby CI authenticates all original records and binds producer, runtime and API", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const options = optionsFor(run), prefix = `${run.label}/records/`;
		const input = { tap: files.get(`${run.label}/run.tap`).toString()
			, runtime: run.runtime
			, interpreter: JSON.parse(files.get(prefix + "interpreter.json"))
			, read: async path => { assert.ok(files.has(prefix + path), path); return files.get(prefix + path); } };
		const result = await checkNominalSubtypeRubyCiRecords(options, input);
		assert.equal(result.executions, 2); assert.equal(result.dispatchObserved, false);
		assert.equal(result.rubyVersion, "3.3.12");
		for(const changed of [{ producer: "0".repeat(40) }, { glibc: "2.38" }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }]) {
			await assert.rejects(checkNominalSubtypeRubyCiRecords({ ...options, ...changed }, input)); controls++;
			}
		for(const runtime of [{ ...run.runtime, arch: "arm64" }, { ...run.runtime, platform: "win32" }, { ...run.runtime, glibc: "2.39" }])
		{ await assert.rejects(checkNominalSubtypeRubyCiRecords(options, { ...input, runtime })); controls++; }
		const original = JSON.parse(await input.read("report.json"));
		for(const mutate of [report => { report.observations.pop(); }
			, report => { report.interpreter.identity.sha256 = "0".repeat(64); }
			, report => { report.offlineInstall = false; }
			, report => { report.reproducible = false; }
			, report => { report.observations[0].counts.checks = 1; }
			, report => { report.sourceRemovedBeforeInstallation = false; }]) {
			const changed = structuredClone(original); mutate(changed);
			await assert.rejects(checkNominalSubtypeRubyCiRecords(options, { ...input
				, read: path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : input.read(path) })); controls++;
			}
		await assert.rejects(checkNominalSubtypeRubyCiRecords(options, { ...input, read: path => {
			if(path === "relocated.json") throw new Error("missing replay");
			return input.read(path);
		} })); controls++;
	}
	t.diagnostic(`${controls} producer, runtime, complete API and original record controls`);
});

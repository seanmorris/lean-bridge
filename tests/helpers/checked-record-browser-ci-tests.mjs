/**
 * Challenge the browser CI gate against original installed evidence, not fabricated passes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCheckedRecordBrowserCiArgs, assertCheckedRecordBrowserCiTap, checkCheckedRecordBrowserCiRecords } from "./checked-record-browser-ci-report.mjs";

const root = "docs/evidence/checked-record-browser-20261011";
const args = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);

test("checked-record browser CI gate and CLI accept all four original installed selections", async () => {
	const index = JSON.parse(await readFile(`${root}/index.json`));
	for(const run of index.runs)
	{
		const options = { route: run.route, producer: run.producerCommit, directory: `${root}/${run.route}/records`, tap: `${root}/${run.route}/run.tap` };
		assert.deepEqual(parseCheckedRecordBrowserCiArgs(args(options)), options);
		const original = { tap: await readFile(options.tap, "utf8"), read: path => readFile(`${options.directory}/${path}`) };
		const checked = await checkCheckedRecordBrowserCiRecords(options, original);
		assert.equal(checked.route, run.route); assert.equal(checked.producerCommit, run.producerCommit);
		const result = spawnSync(process.execPath, ["scripts/check-checked-record-browser-ci.mjs", ...args(options)], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), checked);
		await assert.rejects(checkCheckedRecordBrowserCiRecords({ ...options, producer: "0".repeat(40) }, original));
		for(const wrong of index.runs.filter(other => other.route !== run.route))
			await assert.rejects(checkCheckedRecordBrowserCiRecords({ ...options, route: wrong.route }, original));
		for(const missing of ["report.json", "browser.json", "index.mts", "build-0/locks/compiler-adapters.json", "build-1/CheckedRecords.lean", "browser-worker/observations.json"])
			await assert.rejects(checkCheckedRecordBrowserCiRecords(options, { ...original, read: async path => { assert.notEqual(path, missing); return original.read(path); } }));
	}
});

test("checked-record browser CI refuses ambiguous options, partial TAP, skips and substituted selections", async () => {
	const index = JSON.parse(await readFile(`${root}/index.json`));
	const run = index.runs[0], options = { route: run.route, producer: run.producerCommit, directory: "retained", tap: "original.tap" };
	const selected = args(options);
	const invalidOptions = [[], selected.slice(0, -1)
		, [...selected, "--extra", "yes"]
		, [...selected, "--route", run.route]
		, args({ ...options, route: "ordinary" })
		, args({ ...options, producer: "HEAD" })
		, args({ ...options, directory: "" })
		, args({ ...options, tap: "--flag" })
		, args({ ...options, tap: "bad\0path" })];
	for(const invalid of invalidOptions)
		assert.throws(() => parseCheckedRecordBrowserCiArgs(invalid));
	for(const item of index.runs)
	{
		const source = await readFile(`${root}/${item.route}/run.tap`, "utf8");
		assertCheckedRecordBrowserCiTap(source, item.route);
		const mutations = [source.slice(1), source.replace("1..1\n", "")
			, source.replace("1..1", "1..2")
			, source.replace("ok 1 -", "not ok 1 -"), source + "Bail out! incomplete\n"
			, source + "# SKIP disabled\n", source + "# TODO unfinished\n"
			, source.replaceAll(`relocate ${item.route}`, "relocate invented")
			, source + source, source + "ok 2 - extra\n"];
		for(const [key, value] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		{
			mutations.push(source.replace(`# ${key} ${value}\n`, ""));
			mutations.push(source.replace(`# ${key} ${value}\n`, `# ${key} ${value + 1}\n`));
			mutations.push(source + `# ${key} ${value}\n`);
		}
		for(const changed of mutations)
		{ assert.notEqual(changed, source); assert.throws(() => assertCheckedRecordBrowserCiTap(changed, item.route)); }
	}
});

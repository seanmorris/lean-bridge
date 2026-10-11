/**
 * Challenge the php-wasm CI gate against original installed evidence, not fabricated passes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCheckedRecordPhpWasmCiArgs, assertCheckedRecordPhpWasmCiTap, assertCheckedRecordPhpWasmCompilerTap, checkCheckedRecordPhpWasmCiRecords } from "./checked-record-php-wasm-ci-report.mjs";

const root = "docs/evidence/checked-record-php-wasm-20261011";
const args = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);

test("PHP-Wasm compiler TAP checker rejects omitted, skipped and relabeled compiler controls", () => {
	// Synthetic TAP exercises the parser only; installed evidence comes from the archive below.
	const routes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];
	const cases = ["erased-proof-omission", "changed-index", "reordered-payload", "foreign-constructor", "valid-constructor-change"];
	const names = [...routes.map(route => `fresh Lean PHP-Wasm checked-record ${route}`), ...cases.map(name => `fresh Lean PHP-Wasm ${name}`)];
	const rows = [...routes.map(route => ({
		sourceCompilationOnly: true, route, pointerBits: 32
		, exports: route.startsWith("result-only-") ? 1 : 8
		, generatedCSha256: "a".repeat(64), installedAcceptance: false
	}))
	, ...cases.map(name => ({
		sourceCompilationOnly: true, name
		, compiled: name === "valid-constructor-change"
		, noOutput: true, installedAcceptance: false
	}))];
	const body = names.map((name, index) => `# Subtest: ${name}\nok ${index + 1} - ${name}\n# ${JSON.stringify(rows[index])}\n`).join("");
	const source = "TAP version 13\n" + body + "1..9\n# tests 9\n# suites 0\n# pass 9\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
	assertCheckedRecordPhpWasmCompilerTap(source);
	const changed = [source + source, source + "# SKIP disabled\n"
		, source + "# TODO unfinished\n"
		, source.replace("ok 1 -", "not ok 1 -")
		, source + "Bail out! incomplete\n", source.slice(1)];
	for(const name of names) changed.push(source.replaceAll(name, "wrong test"));
	for(const row of rows)
	{
		const before = JSON.stringify(row);
		changed.push(source.replace(`# ${before}\n`, ""));
		changed.push(source.replace(before, JSON.stringify({ ...row, installedAcceptance: true })));
		changed.push(source.replace(before, JSON.stringify({ ...row, sourceCompilationOnly: false })));
		if(row.route) for(const mutate of [item => { item.pointerBits = 64; }, item => { item.exports++; }, item => { item.generatedCSha256 = "wrong"; }])
		{ const item = structuredClone(row); mutate(item); changed.push(source.replace(before, JSON.stringify(item))); }
		else for(const key of ["compiled", "noOutput"])
			changed.push(source.replace(before, JSON.stringify({ ...row, [key]: !row[key] })));
	}
	for(const [key, value] of Object.entries({ tests: 9, suites: 0, pass: 9, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		changed.push(source.replace(`# ${key} ${value}\n`, ""), source.replace(`# ${key} ${value}\n`, `# ${key} ${value + 1}\n`), source + `# ${key} ${value}\n`);
	changed.push(source.replace("1..9\n", ""), source.replace("1..9\n", "1..8\n"));
	for(const mutation of changed)
	{ assert.notEqual(mutation, source); assert.throws(() => assertCheckedRecordPhpWasmCompilerTap(mutation)); }
	for(const invalid of [[], ["--wrong"], ["one", "two"]])
		assert.notEqual(spawnSync(process.execPath, ["scripts/check-checked-record-php-wasm-compiler-ci.mjs", ...invalid], { encoding: "utf8" }).status, 0);
});

test("checked-record php-wasm CI gate and CLI accept all four original installed selections", async () => {
	const index = JSON.parse(await readFile(`${root}/index.json`));
	for(const run of index.runs)
	{
		const options = { route: run.route, producer: run.producerCommit, directory: `${root}/${run.route}/records`, tap: `${root}/${run.route}/run.tap` };
		assert.deepEqual(parseCheckedRecordPhpWasmCiArgs(args(options)), options);
		const original = { tap: await readFile(options.tap, "utf8"), read: path => readFile(`${options.directory}/${path}`) };
		const checked = await checkCheckedRecordPhpWasmCiRecords(options, original);
		assert.equal(checked.route, run.route); assert.equal(checked.producerCommit, run.producerCommit);
		const result = spawnSync(process.execPath, ["scripts/check-checked-record-php-wasm-ci.mjs", ...args(options)], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), checked);
		await assert.rejects(checkCheckedRecordPhpWasmCiRecords({ ...options, producer: "0".repeat(40) }, original));
		for(const wrong of index.runs.filter(other => other.route !== run.route))
			await assert.rejects(checkCheckedRecordPhpWasmCiRecords({ ...options, route: wrong.route }, original));
		for(const missing of ["report.json", "context.json", "deployment/strict.php", "build-0/model.json", "build-1/CheckedRecords.lean", "executions/11.json"])
			await assert.rejects(checkCheckedRecordPhpWasmCiRecords(options, { ...original, read: async path => { assert.notEqual(path, missing); return original.read(path); } }));
	}
});

test("checked-record php-wasm CI refuses ambiguous options, partial TAP, skips and substituted selections", async () => {
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
		assert.throws(() => parseCheckedRecordPhpWasmCiArgs(invalid));
	for(const item of index.runs)
	{
		const source = await readFile(`${root}/${item.route}/run.tap`, "utf8");
		assertCheckedRecordPhpWasmCiTap(source, item.route);
		const mutations = [source.slice(1), source.replace("1..1\n", "")
			, source.replace("1..1", "1..2")
			, source.replace("ok 1 -", "not ok 1 -"), source + "Bail out! incomplete\n"
			, source + "# SKIP disabled\n", source + "# TODO unfinished\n"
			, source.replaceAll(`PHP-Wasm ${item.route}`, "PHP-Wasm invented")
			, source + source, source + "ok 2 - extra\n"];
		for(const [key, value] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		{
			mutations.push(source.replace(`# ${key} ${value}\n`, ""));
			mutations.push(source.replace(`# ${key} ${value}\n`, `# ${key} ${value + 1}\n`));
			mutations.push(source + `# ${key} ${value}\n`);
		}
		for(const changed of mutations)
		{ assert.notEqual(changed, source); assert.throws(() => assertCheckedRecordPhpWasmCiTap(changed, item.route)); }
	}
});

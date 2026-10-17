/**
 * Exercise recursive checked-record native PHP CI admission with synthetic transcripts.
 * These controls do not substitute for installed package executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	recursiveCheckedRecordPhpCiTestName
	, parseRecursiveCheckedRecordPhpCiArgs
	, assertRecursiveCheckedRecordPhpCiTap
	, checkRecursiveCheckedRecordPhpCiRecords
	, recursiveCheckedRecordPhpCiArtifactPaths
} from "./recursive-checked-record-php-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary", fixture: "recursive", producer: "a".repeat(40)
	, directory: "synthetic-records", tap: "synthetic.tap", glibc: "2.38"
	, php: "/runtime/php", composer: "/runtime/composer"
	, "php-version": "8.3.6", "composer-version": "2.7.1"
};
const syntheticTap = (route, fixture) => {
	const name = recursiveCheckedRecordPhpCiTestName(route, fixture);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
};

test("recursive checked-record native PHP CI counts the Composer ZIP once", () => {
	const archive = "handoff/archives/example-recursivecheckedrecords-1.0.0-linux-x86_64.zip";
	const records = ["report.json", archive, "package/src/Api.php"];
	assert.deepEqual(recursiveCheckedRecordPhpCiArtifactPaths(records, archive)
		, [...records].sort());
	assert.throws(() => recursiveCheckedRecordPhpCiArtifactPaths(
		["report.json", "package/src/Api.php"], archive));
	assert.throws(() => recursiveCheckedRecordPhpCiArtifactPaths(
		[...records, archive], archive));
	assert.throws(() => recursiveCheckedRecordPhpCiArtifactPaths(
		[...records, "report.json"], archive));
});

test("recursive checked-record native PHP CI refuses unknown, duplicate and incomplete selections", () => {
	const args = argsOf(options); assert.deepEqual(parseRecursiveCheckedRecordPhpCiArgs(args), options);
	assert.deepEqual(parseRecursiveCheckedRecordPhpCiArgs(argsOf({ ...options, glibc: "2.36" })), { ...options, glibc: "2.36" });
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseRecursiveCheckedRecordPhpCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseRecursiveCheckedRecordPhpCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", null, true])
			assert.throws(() => parseRecursiveCheckedRecordPhpCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }, { fixture: "recursive,mutual" }
		, { route: "unknown" }, { fixture: "unknown" }, { mode: "full" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }, { unknown: "value" }
		, { php: "php" }, { composer: "composer" }
		, { php: "/runtime/php\n" }, { composer: "/runtime/../composer" }
		, { "php-version": "8.1.0" }, { "composer-version": "1.10.0" }
	]) assert.throws(() => parseRecursiveCheckedRecordPhpCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseRecursiveCheckedRecordPhpCiArgs(invalid));
});

test("recursive checked-record native PHP CI refuses incomplete or false successful-looking TAP", t => {
	let controls = 0;
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const tap = syntheticTap(route, fixture); assertRecursiveCheckedRecordPhpCiTap(tap, route, fixture);
		const changed = [
			tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -")
			, tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n", tap + "# SKIP excluded\n"
			, tap + "# TODO later\n", tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n"), tap + "1..1\n"
			, tap.replace("# Subtest:", "# Wrong:")
			, tap + "ok 2 - unrelated\n", tap + tap
			, ...Object.keys({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }).flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changed)
		{
			assert.notEqual(source, tap); assert.throws(() => assertRecursiveCheckedRecordPhpCiTap(source, route, fixture)); controls++;
		}
		assert.throws(() => assertRecursiveCheckedRecordPhpCiTap(tap, route === "ordinary" ? "reviewed" : "ordinary", fixture));
		assert.throws(() => assertRecursiveCheckedRecordPhpCiTap(tap, route, fixture === "recursive" ? "mutual" : "recursive")); controls += 2;
	}
	assert.equal(controls, 140);
	t.diagnostic("140 synthetic incomplete, mismatched, skipped or failed TAP controls; no installed execution claimed.");
});

test("recursive checked-record native PHP CI rejects bad scope before opening retained records", async () => {
	const tap = syntheticTap(options.route, options.fixture), reads = [];
	const sentinel = new Error("Original package records are required");
	const read = async path => { reads.push(path); throw sentinel; };
	const tools = {
		command: options.php
		, composer: options.composer
		, selected: {
			php: options.php
			, composer: options.composer
			, phpVersion: options["php-version"]
			, composerVersion: options["composer-version"]
		}
	};
	const original = {
		tap, read, tools, archiveSha256: "a".repeat(64)
		, runtime: { platform: "linux", arch: "x64", glibc: "2.38" } };
	await assert.rejects(checkRecursiveCheckedRecordPhpCiRecords({ ...options, producer: "HEAD" }, original), assert.AssertionError);
	await assert.rejects(checkRecursiveCheckedRecordPhpCiRecords(options, { ...original
		, tap: tap.replace("# skipped 0", "# skipped 1") }), assert.AssertionError);
	assert.deepEqual(reads, []);
	await assert.rejects(checkRecursiveCheckedRecordPhpCiRecords(options, original), error => error === sentinel);
	assert.deepEqual(reads, ["tools.json"]);
});

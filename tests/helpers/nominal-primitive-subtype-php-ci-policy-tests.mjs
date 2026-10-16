/**
 * Exercise primitive-base native PHP CI admission with synthetic transcripts.
 * These controls do not substitute for installed package executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	nominalPrimitiveSubtypePhpCiTestName
	, parseNominalPrimitiveSubtypePhpCiArgs
	, assertNominalPrimitiveSubtypePhpCiTap
	, checkNominalPrimitiveSubtypePhpCiRecords
	, nominalPrimitiveSubtypePhpCiPaths
} from "./nominal-primitive-subtype-php-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary", mode: "full", producer: "a".repeat(40)
	, directory: "synthetic-records", tap: "synthetic.tap", glibc: "2.38"
	, php: "/runtime/php", composer: "/runtime/composer"
	, "php-version": "8.3.6", "composer-version": "2.7.1"
};
const syntheticTap = (route, mode) => {
	const name = nominalPrimitiveSubtypePhpCiTestName(route, mode);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
};

test("primitive-base native PHP CI refuses unknown, duplicate and incomplete selections", () => {
	const args = argsOf(options); assert.deepEqual(parseNominalPrimitiveSubtypePhpCiArgs(args), options);
	assert.deepEqual(parseNominalPrimitiveSubtypePhpCiArgs(argsOf({ ...options, glibc: "2.36" })), { ...options, glibc: "2.36" });
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalPrimitiveSubtypePhpCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalPrimitiveSubtypePhpCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", null, true])
			assert.throws(() => parseNominalPrimitiveSubtypePhpCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }, { mode: "full,result-only" }
		, { route: "unknown" }, { mode: "unknown" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }, { unknown: "value" }
		, { php: "php" }, { composer: "composer" }
		, { php: "/runtime/php\n" }, { composer: "/runtime/../composer" }
		, { "php-version": "8.1.0" }, { "composer-version": "1.10.0" }
	]) assert.throws(() => parseNominalPrimitiveSubtypePhpCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalPrimitiveSubtypePhpCiArgs(invalid));
});

test("primitive-base native PHP CI refuses incomplete or false successful-looking TAP", t => {
	let controls = 0;
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["full", "result-only"])
	{
		const tap = syntheticTap(route, mode); assertNominalPrimitiveSubtypePhpCiTap(tap, route, mode);
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
			assert.notEqual(source, tap); assert.throws(() => assertNominalPrimitiveSubtypePhpCiTap(source, route, mode)); controls++;
		}
		assert.throws(() => assertNominalPrimitiveSubtypePhpCiTap(tap, route === "ordinary" ? "reviewed" : "ordinary", mode));
		assert.throws(() => assertNominalPrimitiveSubtypePhpCiTap(tap, route, mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 140);
	t.diagnostic("140 synthetic incomplete, mismatched, skipped or failed TAP controls; no installed execution claimed.");
});

test("primitive-base native PHP CI rejects bad scope before opening retained records", async () => {
	const tap = syntheticTap(options.route, options.mode), reads = [];
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
	await assert.rejects(checkNominalPrimitiveSubtypePhpCiRecords({ ...options, producer: "HEAD" }, original), assert.AssertionError);
	await assert.rejects(checkNominalPrimitiveSubtypePhpCiRecords(options, { ...original
		, tap: tap.replace("# skipped 0", "# skipped 1") }), assert.AssertionError);
	assert.deepEqual(reads, []);
	await assert.rejects(checkNominalPrimitiveSubtypePhpCiRecords(options, original), error => error === sentinel);
	assert.deepEqual(reads, ["tools.json"]);
});

test("primitive-base native PHP CI expects the original ZIP exactly once", () => {
	// Hosted run 38824636357 appended the ZIP to records that already listed it.
	const archive = "handoff/archives/example-nominalprimitivesubtypes-1.0.0-linux-x86_64.zip";
	const records = ["report.json", archive, "handoff/package-set-receipt.json", "consumer.php"];
	assert.deepEqual(nominalPrimitiveSubtypePhpCiPaths(records, archive), [...records].sort());
	assert.equal(nominalPrimitiveSubtypePhpCiPaths(records, archive).filter(path => path === archive).length, 1);
	assert.throws(() => nominalPrimitiveSubtypePhpCiPaths(records.filter(path => path !== archive), archive), /omit the original ZIP/u);
	assert.throws(() => nominalPrimitiveSubtypePhpCiPaths([...records, archive], archive), /Duplicate retained/u);
});

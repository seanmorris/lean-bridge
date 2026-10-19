/**
 * Lock the closed route/TAP/retained-record contract for hosted Perl checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertCheckedRecordValueIndexPerlCiTap, checkedRecordValueIndexPerlCiTestName
	, checkedRecordValueIndexPerlRecordPaths, parseCheckedRecordValueIndexPerlCiArgs
} from "./checked-record-value-index-perl-ci-report.mjs";
import {
	assertCheckedRecordValueIndexPerlAuthorInput
	, assertCheckedRecordValueIndexPerlProcess
} from "./checked-record-value-index-perl-records.mjs";
import {
	checkedRecordValueIndexPerlConfigurations
	, checkedRecordValueIndexPerlInstallModes
} from "./checked-record-value-index-perl-install.mjs";
import { checkedRecordValueIndexPerlRoutes } from "./checked-record-value-index-perl-fixture.mjs";

const producer = "a".repeat(40);

test("value-index Perl author-input records retain timing metadata without weakening identity", () => {
	const input = {
		path: "CheckedRecordValueIndices.lean", mode: 33188
		, mtime: 1_726_000_000_000.25, ctime: 1_726_000_000_001.5
		, sha256: "b".repeat(64)
	};
	assert.doesNotThrow(() => assertCheckedRecordValueIndexPerlAuthorInput(
		input, "author input"
	));
	for(const changed of [
		{ ...input, mtime: -1 }, { ...input, ctime: Infinity }
		, { ...input, mode: 33152 }, { ...input, path: "../outside" }
		, { ...input, sha256: "short" }, { ...input, extra: true }
	]) assert.throws(() => assertCheckedRecordValueIndexPerlAuthorInput(
		changed, "author input"
	));
});

test("value-index Perl process records require the compact successful caller protocol", () => {
	const expected = { calls: 28, checks: 49, recoveries: 6, rejections: 6, snapshots: 14 };
	const result = { code: 0, stderr: "", stdout: `${JSON.stringify(expected)}\n` };
	assert.doesNotThrow(() => assertCheckedRecordValueIndexPerlProcess(
		result, expected, "process"
	));
	for(const changed of [
		{ ...result, code: 1 }, { ...result, stderr: "unexpected" }
		, { ...result, stdout: `${JSON.stringify({ ...expected, calls: 0 })}\n` }
		, { ...result, stdout: `${JSON.stringify(expected, null, 2)}\n` }
		, { ...result, extra: true }
	]) assert.throws(() => assertCheckedRecordValueIndexPerlProcess(
		changed, expected, "process"
	));
});

for(const route of checkedRecordValueIndexPerlRoutes) test(
	`value-index Perl CI only accepts the exact ${route} TAP`, () => {
		const title = checkedRecordValueIndexPerlCiTestName(route);
		const tap = [
			"TAP version 13", `# Subtest: ${title}`, `ok 1 - ${title}`
			, "  ---", "  duration_ms: 1", "  ...", "1..1", "# tests 1"
			, "# suites 0", "# pass 1", "# fail 0", "# cancelled 0", "# skipped 0"
			, "# todo 0", "# duration_ms 1", ""
		].join("\n");
		assert.doesNotThrow(() => assertCheckedRecordValueIndexPerlCiTap(tap, route));
		for(const changed of [
			tap.replace("ok 1", "not ok 1"), tap.replace("# pass 1", "# pass 0")
			, tap.replace("# skipped 0", "# skipped 1")
			, tap.replace(title, "substituted")
		]) assert.throws(() => assertCheckedRecordValueIndexPerlCiTap(changed, route));
	}
);

test("value-index Perl CI parser closes every checker argument", () => {
	const args = [
		"--route", "ordinary-source", "--producer", producer, "--directory", "records"
		, "--tap", "run.tap", "--glibc", "2.38", "--max-load", "8"
	];
	assert.deepEqual(parseCheckedRecordValueIndexPerlCiArgs(args), {
		route: "ordinary-source", producer, directory: "records", tap: "run.tap"
		, glibc: "2.38", maxLoad: 8
	});
	for(const changed of [
		args.slice(0, -1), [...args, "extra"]
		, args.map(value =>
			value === "ordinary-source" ? "other" : value)
			, args.map(value =>
			value === "2.38" ? "3.0" : value)
			, args.map(value =>
			value === "8" ? "9" : value)
			, args.map(value =>
			value === "records" ? "../records" : value)
	]) assert.throws(() => parseCheckedRecordValueIndexPerlCiArgs(changed));
});

for(const route of checkedRecordValueIndexPerlRoutes) test(
	`value-index Perl retained records close the ${route} matrix`, () => {
		const paths = checkedRecordValueIndexPerlRecordPaths(route);
		assert.deepEqual(paths, [...paths].sort());
		assert.equal(new Set(paths).size, paths.length);
		for(const name of [
			"configuration.json"
			, "consumer.pl"
			, "expected.binding-ir.json"
			, "interpreters.json"
			, "report.json", "runtime.json", "build-0/author-inputs.json"
			, "build-1/package-set-receipt.json"
		]) assert.ok(paths.includes(name), name);
		for(const configuration of checkedRecordValueIndexPerlConfigurations)
			for(const installMode of checkedRecordValueIndexPerlInstallModes)
				for(const name of [
					"component-manifest.json", "installed.json", "relocated.json"
					, "runtime-manifest.json", "report.json"
				]) assert.ok(paths.includes(`${configuration}/${installMode}/${name}`));
		assert.equal(paths.includes("build-0/api.binding-ir.json"), route.endsWith("reviewed-ir"));
	}
);

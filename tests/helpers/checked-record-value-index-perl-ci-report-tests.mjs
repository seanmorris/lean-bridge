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
	checkedRecordValueIndexPerlConfigurations
	, checkedRecordValueIndexPerlInstallModes
} from "./checked-record-value-index-perl-install.mjs";
import { checkedRecordValueIndexPerlRoutes } from "./checked-record-value-index-perl-fixture.mjs";

const producer = "a".repeat(40);

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

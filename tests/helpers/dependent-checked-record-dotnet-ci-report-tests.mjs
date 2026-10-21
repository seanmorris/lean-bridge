/**
 * Static controls for the dependent checked-record .NET hosted checker contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertDependentCheckedRecordDotnetCiTap, parseDependentCheckedRecordDotnetCiArgs
	, dependentCheckedRecordDotnetCiTestName, dependentCheckedRecordDotnetRecordPaths
} from "./dependent-checked-record-dotnet-ci-report.mjs";

const args = route => [
	"--route", route, "--producer", "a".repeat(40)
	, "--consumer", "b".repeat(40), "--directory", "/tmp/records"
	, "--tap", "/tmp/run.tap", "--glibc", "2.38"
	, "--dotnet", "/tmp/dotnet"
];

test("dependent checked-record .NET checker accepts only one closed CLI selection", () => {
	assert.deepEqual(parseDependentCheckedRecordDotnetCiArgs(args("ordinary-source")), {
		route: "ordinary-source", producer: "a".repeat(40)
		, consumer: "b".repeat(40), directory: "/tmp/records"
		, tap: "/tmp/run.tap", glibc: "2.38", dotnet: "/tmp/dotnet"
	});
	for(const changed of [
		args("ordinary-source").slice(2)
		, [...args("ordinary-source"), "--tap", "/tmp/other.tap"]
		, args("ordinary-source").map(value =>
			value === "ordinary-source" ? "unknown" : value)
		, args("ordinary-source").map(value =>
			value === "/tmp/dotnet" ? "relative" : value)
	]) assert.throws(() => parseDependentCheckedRecordDotnetCiArgs(changed));
});

test("dependent checked-record .NET checker requires one exact terminal TAP result", () => {
	const route = "reviewed-ir", name = dependentCheckedRecordDotnetCiTestName(route);
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
	assert.doesNotThrow(() => assertDependentCheckedRecordDotnetCiTap(tap, route));
	for(const changed of [
		tap.replace("ok 1", "not ok 1")
		, tap.replace("# skipped 0", "# skipped 1")
		, tap.replace(name, "other")
	]) assert.throws(() => assertDependentCheckedRecordDotnetCiTap(changed, route));
});

test("dependent checked-record .NET record inventory is route-sensitive and closed", () => {
	const receipt = {
		packages: [{ artifacts: [{ path: "archives/Package.1.0.0.nupkg" }] }]
	};
	const ordinary = dependentCheckedRecordDotnetRecordPaths("ordinary-source", receipt);
	const reviewed = dependentCheckedRecordDotnetRecordPaths("reviewed-ir", receipt);
	assert.equal(new Set(ordinary).size, ordinary.length);
	assert.equal(new Set(reviewed).size, reviewed.length);
	assert.equal(reviewed.length, ordinary.length + 2);
	assert.ok(reviewed.includes("build-0/api.binding-ir.json"));
	assert.ok(reviewed.includes("build-1/api.binding-ir.json"));
	assert.ok(ordinary.includes(
		"handoff/archives/Package.1.0.0.nupkg"
	));
});

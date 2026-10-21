/**
 * Require complete hosted dependent checked-record npm/browser records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	dependentCheckedRecordRoutes
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	checkDependentCheckedRecordBrowserReport
	, dependentCheckedRecordBrowserRecordPaths
} from "./dependent-checked-record-browser-report.mjs";

const usage = "Usage: check-dependent-checked-record-browser-ci.mjs --route <ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir> --producer <commit> --checker <commit> --directory <records> --tap <original-tap>";

/**
 * Require the one complete four-route producer TAP stream.
 *
 * @param source - Original hosted node:test TAP.
 */
export const assertDependentCheckedRecordBrowserCiTap = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /# (?:SKIP|TODO)/u);
	const names = dependentCheckedRecordRoutes.map(route =>
		`installed dependent checked records reproduce and relocate ${route}`);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), names);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]])
	, names.map((name, index) => [index + 1, name]));
	assert.match(source, new RegExp(
		"\\n1\\.\\.4\\n# tests 4\\n# suites 0\\n# pass 4\\n# fail 0"
		+ "\\n# cancelled 0\\n# skipped 0\\n# todo 0"
		+ "\\n# duration_ms [0-9]+(?:\\.[0-9]+)?\\n$"
		, "u"));
};

/**
 * Refuse ambiguous checker selections before opening retained records.
 *
 * @param args - Arguments following the executable script name.
 */
export const parseDependentCheckedRecordBrowserCiArgs = args => {
	const allowed = ["route", "producer", "checker", "directory", "tap"];
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key)
			&& typeof value === "string" && value.length > 0
			&& !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(dependentCheckedRecordRoutes.includes(selected.route), usage);
	for(const key of ["producer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	return selected;
};

/**
 * Reconcile the producer TAP, exact inventory and every retained report.
 *
 * @param options - Closed identities and route.
 * @param original - Immutable hosted observations.
 * @param original.tap - Complete four-route producer TAP.
 * @param original.paths - Complete route-relative regular-file inventory.
 * @param original.read - Closed route-relative byte reader.
 */
export const checkDependentCheckedRecordBrowserCiRecords = async (
	options, original
) => {
	const selected = parseDependentCheckedRecordBrowserCiArgs(
		Object.entries(options).flatMap(
			([key, value]) => ["--" + key, value]
		)
	);
	assertDependentCheckedRecordBrowserCiTap(original.tap);
	const report = JSON.parse(await original.read("report.json"));
	const expected = dependentCheckedRecordBrowserRecordPaths(report.receipt);
	assert.equal(new Set(expected).size, expected.length);
	assert.deepEqual(original.paths, expected);
	const accepted = await checkDependentCheckedRecordBrowserReport(
		original.read, {
			route: selected.route, producerCommit: selected.producer
		}
	);
	return {
		...accepted
		, sourceIdentities: {
			producer: selected.producer, checker: selected.checker
		}
	};
};

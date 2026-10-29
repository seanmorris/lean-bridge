/**
 * Require complete hosted dependent checked-record C/C++ records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	dependentCheckedRecordNativeRoutes
} from "./dependent-checked-record-native-fixture.mjs";
import {
	checkDependentCheckedRecordNativeReport
	, dependentCheckedRecordNativeRecordPaths
} from "./dependent-checked-record-native-report.mjs";

const usage = "Usage: check-dependent-checked-record-native-ci.mjs --route <ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir> --producer <commit> --checker <commit> --directory <records> --tap <original-tap> --floor <glibc>";

/**
 * Require one exact complete route TAP stream.
 *
 * @param source - Original hosted node:test TAP.
 * @param route - Closed author route.
 */
export const assertDependentCheckedRecordNativeCiTap = (source, route) => {
	assert.ok(dependentCheckedRecordNativeRoutes.includes(route));
	const name
		= `installed dependent records reproduce and relocate in C/C++ for ${route}`;
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /# (?:SKIP|TODO)/u);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [name]);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.match(source, new RegExp(
		"\\n1\\.\\.1\\n# tests 1\\n# suites 0\\n# pass 1\\n# fail 0"
		+ "\\n# cancelled 0\\n# skipped 0\\n# todo 0"
		+ "\\n# duration_ms [0-9]+(?:\\.[0-9]+)?\\n$"
		, "u"));
};

/**
 * Refuse ambiguous checker selections before opening retained records.
 *
 * @param args - Arguments following the executable script name.
 */
export const parseDependentCheckedRecordNativeCiArgs = args => {
	const allowed = [
		"route", "producer", "checker", "directory", "tap", "floor"
	];
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
	assert.ok(dependentCheckedRecordNativeRoutes.includes(selected.route)
		, usage);
	for(const key of ["producer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	assert.match(selected.floor, /^2\.[0-9]+$/u, usage);
	return selected;
};

/**
 * Reconcile one route TAP, exact file inventory, package archives and reports.
 *
 * @param options - Closed identities, route and ABI floor.
 * @param original - Immutable hosted observations.
 * @param original.tap - Complete one-route producer TAP.
 * @param original.paths - Complete route-relative regular-file inventory.
 * @param original.read - Closed route-relative byte reader.
 */
export const checkDependentCheckedRecordNativeCiRecords = async (
	options, original
) => {
	const selected = parseDependentCheckedRecordNativeCiArgs(
		Object.entries(options).flatMap(
			([key, value]) => ["--" + key, value]
		)
	);
	assertDependentCheckedRecordNativeCiTap(original.tap, selected.route);
	const report = JSON.parse(await original.read("report.json"));
	const expected = dependentCheckedRecordNativeRecordPaths(
		selected.route, report.receipt
	);
	assert.equal(new Set(expected).size, expected.length);
	assert.deepEqual(original.paths, expected);
	const accepted = await checkDependentCheckedRecordNativeReport(
		original.read, {
			route: selected.route, producerCommit: selected.producer
			, floor: selected.floor
		}
	);
	return {
		...accepted
		, sourceIdentities: {
			producer: selected.producer, checker: selected.checker
		}
		, floor: selected.floor
	};
};

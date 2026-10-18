/**
 * Require one complete value-index C# route with fresh host measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import {
	checkedRecordValueIndexDotnetRoutes, checkedRecordValueIndexDotnetSelection
} from "./checked-record-value-index-dotnet-fixture.mjs";
import {
	checkCheckedRecordValueIndexDotnetReport
} from "./checked-record-value-index-dotnet-report.mjs";

/**
 * Name the only producer test admitted by one route selection.
 *
 * @param route - Closed ordinary/reviewed and full/result-only route.
 */
export const checkedRecordValueIndexDotnetCiTestName = route => {
	assert.ok(checkedRecordValueIndexDotnetRoutes.includes(route));
	return `installed value-index records reproduce and relocate in .NET for ${route}`;
};

/**
 * Reject unknown, repeated and incomplete checker options.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseCheckedRecordValueIndexDotnetCiArgs = args => {
	const usage = "Usage: check-checked-record-value-index-dotnet-ci.mjs --route <closed-route> --producer <commit> --consumer <commit> --directory <records> --tap <original-tap> --glibc 2.38 --dotnet /absolute/dotnet";
	const allowed = [
		"route", "producer", "consumer", "directory", "tap", "glibc", "dotnet"
	];
	const selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	checkedRecordValueIndexDotnetCiTestName(selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u, usage);
	assert.match(selected.consumer, /^[a-f0-9]{40}$/u, usage);
	assert.equal(selected.glibc, "2.38", usage);
	assert.ok(isAbsolute(selected.dotnet), usage);
	return selected;
};

/**
 * Require zero-skip TAP with exactly one matching terminal result.
 *
 * @param source - Original producer TAP.
 * @param route - Required source/API route.
 */
export const assertCheckedRecordValueIndexDotnetCiTap = (source, route) => {
	const name = checkedRecordValueIndexDotnetCiTestName(route)
		.replace("#", "\\#");
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0
		, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(
			`^# ${key} (\\d+)$`, "gmu"
		))];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Reconcile complete records with independently observed host identities.
 *
 * @param options - Closed route, revisions, floor and tool selection.
 * @param original - Original records and fresh host observations.
 * @param original.tap - Complete original producer TAP.
 * @param original.read - Selection-relative original record reader.
 * @param original.runtime - Fresh platform, architecture and glibc identity.
 * @param original.toolchain - Fresh dotnet host and SDK identity.
 * @param original.framework - Fresh shared-framework identities.
 * @param original.archiveSha512 - Digest of the verified original archive.
 */
export const checkCheckedRecordValueIndexDotnetCiRecords = async (
	options, { tap, read, runtime, toolchain, framework, archiveSha512 }
) => {
	const selected = parseCheckedRecordValueIndexDotnetCiArgs(
		Object.entries(options).flatMap(([key, value]) => ["--" + key, value])
	);
	assertCheckedRecordValueIndexDotnetCiTap(tap, selected.route);
	assert.equal(toolchain.command, selected.dotnet);
	assert.equal(toolchain.sdk.version, "8.0.424");
	const selection = checkedRecordValueIndexDotnetSelection(selected.route);
	const accepted = await checkCheckedRecordValueIndexDotnetReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer, runtime
		, floor: selected.glibc, toolchain, framework, archiveSha512
	});
	assert.equal(accepted.mode
		, selection.resultOnly ? "result-only" : "full");
	return accepted;
};

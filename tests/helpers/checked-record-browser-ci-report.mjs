/**
 * Require an exact installed checked-record browser route and complete original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { checkedRecordBrowserRoutes } from "./checked-record-browser-fixture.mjs";
import { checkCheckedRecordBrowserReport } from "./checked-record-browser-report.mjs";

/**
 * Parse the closed option set before opening any retained records.
 *
 * @param args - Arguments following the executable script name.
 */
export const parseCheckedRecordBrowserCiArgs = args => {
	const usage = "Usage: check-checked-record-browser-ci.mjs --route <route> --producer <commit> --directory <records> --tap <original-tap>";
	const allowed = ["route", "producer", "directory", "tap"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.ok(checkedRecordBrowserRoutes.includes(selected.route), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Refuse partial runs, renamed selections, skips and appended success summaries.
 *
 * @param source - Original combined producer output.
 * @param route - Explicit required author and package selection.
 */
export const assertCheckedRecordBrowserCiTap = (source, route) => {
	assert.ok(checkedRecordBrowserRoutes.includes(route));
	const name = `installed npm checked records reproduce and relocate ${route}`;
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
};

/**
 * Authenticate original installed records without following reported producer paths.
 *
 * @param options - Closed parsed route, original producer and input paths.
 * @param original - Original TAP and route-relative retained file reader.
 * @param original.tap - Combined producer stdout and stderr.
 * @param original.read - Reads retained bytes, not historical machine paths.
 */
export const checkCheckedRecordBrowserCiRecords = async (options, { tap, read }) => {
	const selected = parseCheckedRecordBrowserCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertCheckedRecordBrowserCiTap(tap, selected.route);
	return checkCheckedRecordBrowserReport(read, { route: selected.route, producerCommit: selected.producer });
};

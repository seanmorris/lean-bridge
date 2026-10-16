/**
 * Closed PHP-Wasm route/API selections and their exact terminal TAP.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nestedCheckedRecordPhpWasmSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

/**
 * Require one passing, unskipped installed test for exactly the selected route and API.
 *
 * @param source - Complete original TAP transcript.
 * @param route - Ordinary or reviewed author route.
 * @param mode - Full or constructor-free result-only API.
 */
export const assertNestedCheckedRecordPhpWasmTap = (source, route, mode) => {
	assert.ok(nestedCheckedRecordPhpWasmSelections.some(item => item[0] === route && item[1] === mode));
	const name = `installed nested checked-record PHP-Wasm packages reproduce and relocate ${route} ${mode}`;
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
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

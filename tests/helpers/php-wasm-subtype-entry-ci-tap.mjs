/**
 * Require the two selected installed probes to execute, without skipped or missing tests.
 *
 * @file
 */
import assert from "node:assert/strict";

export const phpWasmSubtypeEntryTestPattern = "^(ordinary|reviewed) installed PHP-Wasm Subtype entry probes record constructor and source calls$";

/**
 * Check the exact original Node TAP for the two-test installed CI invocation.
 *
 * @param source - Complete unmodified stdout/stderr captured from the producer.
 */
export const assertPhpWasmSubtypeEntryTap = source => {
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	const passed = [...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]);
	assert.deepEqual(passed, ["ordinary", "reviewed"].map((route, index) => [index + 1, `${route} installed PHP-Wasm Subtype entry probes record constructor and source calls`]));
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), passed.map(item => item[1]));
	for(const [name, expected] of Object.entries({ tests: 2, suites: 0, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, name); assert.equal(Number(matches[0][1]), expected, name);
	}
	assert.equal([...source.matchAll(/^1\.\.2$/gmu)].length, 1);
	return true;
};

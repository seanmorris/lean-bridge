/**
 * Independently specified PHP caller for inherited checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export const inheritedCheckedRecordPhpRoutes = Object.freeze(["ordinary", "reviewed"]);
export const inheritedCheckedRecordPhpModes = Object.freeze(["full", "result-only"]);
/** The caller fixes these totals independently of generated package metadata. */
export const inheritedCheckedRecordPhpCounts = Object.freeze({
	full: Object.freeze({
		checks: 5680, rejections: 1291, calls: 2839
		, snapshots: 2839, recoveries: 256, rounds: 256
	})
	, "result-only": Object.freeze({
		checks: 1042, rejections: 0, calls: 518
		, snapshots: 518, recoveries: 0, rounds: 256
	})
});

/**
 * Select API breadth and diagnostic parameter names through two fixed constants.
 *
 * @param route - Ordinary or independently reviewed source route.
 * @param mode - Full or constructor-free result-only API.
 */
export const inheritedCheckedRecordPhpCaller = async (route, mode) => {
	assert.ok(inheritedCheckedRecordPhpRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPhpModes.includes(mode));
	let source = await readFile(
		"tests/fixtures/inherited-checked-record-consumers/php-native.php", "utf8"
	);
	const selections = [
		"const INHERITED_CHECKED_RECORD_RESULT_ONLY = false;"
		, "const INHERITED_PARAMETER_PREFIX = 'arg';"
	];
	for(const selection of selections)
		assert.equal(source.split(selection).length, 2, selection);
	if(mode === "result-only") source = source.replace(
		selections[0], "const INHERITED_CHECKED_RECORD_RESULT_ONLY = true;"
	);
	if(route === "reviewed") source = source.replace(
		selections[1], "const INHERITED_PARAMETER_PREFIX = 'value';"
	);
	return source;
};

/**
 * Require every independently fixed result counter.
 *
 * @param stdout - Complete caller output.
 * @param mode - Full or constructor-free result-only API.
 */
export const parseInheritedCheckedRecordPhpResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordPhpModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordPhpCounts[mode]);
	return result;
};

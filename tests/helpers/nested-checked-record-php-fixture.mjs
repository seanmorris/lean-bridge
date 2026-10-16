/**
 * Closed Php selections and the independently specified nested checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordName, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordPhpRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordPhpModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordPhpTarget = Object.freeze({ name: `example/${nestedCheckedRecordName}`, version: "1.0.0" });
/** Independent caller totals; result-only replays only the constructor-free producers. */
export const nestedCheckedRecordPhpCounts = Object.freeze({
	full: Object.freeze({ checks: 3705, rejections: 525, hostRejections: 16, recoveries: 256, snapshots: 1840, snapshotControls: 12, rounds: 256 })
	, "result-only": Object.freeze({ checks: 1060, rejections: 0, hostRejections: 6, recoveries: 0, snapshots: 520, snapshotControls: 7, rounds: 256 })
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const nestedCheckedRecordPhpSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nested checked-record Php TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record Php ${name}`);
			assert.equal(flag, "1", `Explicit nested checked-record Php ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nested checked-record Php ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nested checked-record Php ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined) assert.equal(flag, "1", `Explicit ${prefix}${name} requires TEST=1`);
	return { enabled: flag === "1", routes: select("ROUTES", nestedCheckedRecordPhpRoutes), modes: select("MODES", nestedCheckedRecordPhpModes) };
};

/**
 * Keep every nested checked-record identity and per-site constructor decision.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nestedCheckedRecordPhpReview = mode => {
	assert.ok(nestedCheckedRecordPhpModes.includes(mode)); return nestedCheckedRecordReview(mode);
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nestedCheckedRecordPhpConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordPhpRoutes.includes(route)); assert.ok(nestedCheckedRecordPhpModes.includes(mode));
	return { ...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: { "php-native": { ...nestedCheckedRecordPhpTarget } } };
};

/**
 * Select the API and diagnostic names through the caller's two declared constants.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full or standalone result-only API.
 */
export const nestedCheckedRecordPhpCaller = async (route, mode) => {
	assert.ok(nestedCheckedRecordPhpRoutes.includes(route)); assert.ok(nestedCheckedRecordPhpModes.includes(mode));
	let source = await readFile("tests/fixtures/nested-checked-record-consumers/php-native.php", "utf8");
	for(const line of ["const NESTED_CHECKED_RECORD_RESULT_ONLY = false;", "const NESTED_PARAMETER_PREFIX = 'arg';"])
		assert.equal(source.split(line).length, 2, line);
	if(mode === "result-only") source = source.replace("const NESTED_CHECKED_RECORD_RESULT_ONLY = false;", "const NESTED_CHECKED_RECORD_RESULT_ONLY = true;");
	if(route === "reviewed") source = source.replace("const NESTED_PARAMETER_PREFIX = 'arg';", "const NESTED_PARAMETER_PREFIX = 'value';");
	return source;
};

/**
 * Require every check and expected rejection for the selected API.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package mode.
 */
export const parseNestedCheckedRecordPhpResult = (stdout, mode) => {
	assert.ok(nestedCheckedRecordPhpModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nestedCheckedRecordPhpCounts[mode]);
	return result;
};

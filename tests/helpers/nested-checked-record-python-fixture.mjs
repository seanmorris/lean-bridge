/**
 * Closed Python selections and the independently specified nested checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordName, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordPythonRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordPythonModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordPythonMinors = Object.freeze(["3.11", "3.12"]);
export const nestedCheckedRecordPythonPackage = "lean_" + nestedCheckedRecordName;
export const nestedCheckedRecordPythonTarget = Object.freeze({ name: nestedCheckedRecordName, version: "1.0.0" });
/** Independent caller totals; result-only replays only the constructor-free producers. */
export const nestedCheckedRecordPythonCounts = Object.freeze({
	full: Object.freeze({ checks: 3704, rejections: 525, hostRejections: 15, recoveries: 256, snapshots: 1840, snapshotControls: 11, rounds: 256 })
	, "result-only": Object.freeze({ checks: 1057, rejections: 0, hostRejections: 4, recoveries: 0, snapshots: 518, snapshotControls: 8, rounds: 256 })
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const nestedCheckedRecordPythonSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nested checked-record Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record Python ${name}`);
			assert.equal(flag, "1", `Explicit nested checked-record Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nested checked-record Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nested checked-record Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return { enabled: flag === "1", routes: select("ROUTES", nestedCheckedRecordPythonRoutes), modes: select("MODES", nestedCheckedRecordPythonModes) };
};

/**
 * Both interpreter floors consume the same independently reproduced wheels.
 *
 * @param raw - Explicit JSON object mapping both minor versions to absolute executables.
 */
export const nestedCheckedRecordPythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), nestedCheckedRecordPythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, 2, "Select distinct Python executables");
	return Object.fromEntries(nestedCheckedRecordPythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Keep every nested checked-record identity and per-site constructor decision.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nestedCheckedRecordPythonReview = mode => {
	assert.ok(nestedCheckedRecordPythonModes.includes(mode)); return nestedCheckedRecordReview(mode);
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nestedCheckedRecordPythonConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordPythonRoutes.includes(route)); assert.ok(nestedCheckedRecordPythonModes.includes(mode));
	return { ...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: { pypi: { ...nestedCheckedRecordPythonTarget } } };
};

/**
 * Load the unchanged caller; the runner passes the explicit author route and mode.
 *
 * @param route - Explicit source route.
 */
export const nestedCheckedRecordPythonCaller = async route => {
	assert.ok(nestedCheckedRecordPythonRoutes.includes(route));
	return readFile("tests/fixtures/nested-checked-record-consumers/python.py", "utf8");
};

/**
 * Explicit caller arguments for one selection; the source itself never changes.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full or standalone result-only API.
 */
export const nestedCheckedRecordPythonCallerArgs = (route, mode) => {
	assert.ok(nestedCheckedRecordPythonRoutes.includes(route)); assert.ok(nestedCheckedRecordPythonModes.includes(mode));
	return [...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []];
};

/**
 * Require every check and expected rejection for the selected API.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package mode.
 */
export const parseNestedCheckedRecordPythonResult = (stdout, mode) => {
	assert.ok(nestedCheckedRecordPythonModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nestedCheckedRecordPythonCounts[mode]);
	return result;
};

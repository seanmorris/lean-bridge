/**
 * Closed Python selections and the independently specified recursive checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordConfiguration, recursiveCheckedRecordFixtureRoot
	, recursiveCheckedRecordModule, recursiveCheckedRecordReview
} from "./recursive-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordPythonLoadCeiling, recursiveCheckedRecordPythonLoadCeilings
} from "./recursive-checked-record-python-resources.mjs";

export const recursiveCheckedRecordPythonRoutes = Object.freeze(["ordinary", "reviewed"]);
export const recursiveCheckedRecordPythonFixtures = Object.freeze(["recursive", "mutual"]);
export const recursiveCheckedRecordPythonMinors = Object.freeze(["3.11", "3.12"]);
export const recursiveCheckedRecordPythonCaller
	= "tests/fixtures/recursive-checked-record-consumers/python.py";
const fixtures = {
	recursive: {
		root: recursiveCheckedRecordFixtureRoot
		, module: recursiveCheckedRecordModule
		, review: recursiveCheckedRecordReview
		, configuration: recursiveCheckedRecordConfiguration
	}
	, mutual: {
		root: mutualCheckedRecordFixtureRoot
		, module: mutualCheckedRecordModule
		, review: mutualCheckedRecordReview
		, configuration: mutualCheckedRecordConfiguration
	}
};
/** Independent caller totals for each module; both routes run the same caller. */
export const recursiveCheckedRecordPythonCounts = Object.freeze({
	recursive: Object.freeze({
		checks: 1083, rejections: 144, hostRejections: 78, recoveries: 64
		, snapshots: 495, snapshotControls: 8, rounds: 64, module: "recursive"
	})
	, mutual: Object.freeze({
		checks: 1100, rejections: 144, hostRejections: 80, recoveries: 64
		, snapshots: 501, snapshotControls: 11, rounds: 64, module: "mutual"
	})
});

/**
 * Exact package coordinates; the module directory is derived from the component name.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPythonPackage = fixture => {
	assert.ok(recursiveCheckedRecordPythonFixtures.includes(fixture));
	const name = `${fixture}checkedrecords`;
	return Object.freeze({ name, version: "1.0.0", moduleName: `lean_${name}`
		, root: fixtures[fixture].root, leanModule: fixtures[fixture].module });
};

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const recursiveCheckedRecordPythonSelection = environment => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid recursive checked-record Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid recursive checked-record Python ${name}`);
			assert.equal(flag, "1", `Explicit recursive checked-record Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid recursive checked-record Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate recursive checked-record Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD", "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined ? recursiveCheckedRecordPythonLoadCeiling : Number(rawLoad);
	assert.ok(recursiveCheckedRecordPythonLoadCeilings.includes(maxLoad)
		, `Recursive checked-record Python max load must be one of ${recursiveCheckedRecordPythonLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", recursiveCheckedRecordPythonRoutes)
		, fixtures: select("FIXTURES", recursiveCheckedRecordPythonFixtures)
		, maxLoad
	};
};

/**
 * Both interpreter floors consume the same independently reproduced wheels.
 *
 * @param raw - Explicit JSON object mapping both minor versions to absolute executables.
 */
export const recursiveCheckedRecordPythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), recursiveCheckedRecordPythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value)
			, "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, 2, "Select distinct Python executables");
	return Object.fromEntries(recursiveCheckedRecordPythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Keep every recursive identity, alias and per-site constructor decision.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPythonReview = fixture => {
	assert.ok(recursiveCheckedRecordPythonFixtures.includes(fixture));
	return fixtures[fixture].review();
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPythonConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordPythonRoutes.includes(route));
	const { name, version } = recursiveCheckedRecordPythonPackage(fixture);
	return { ...fixtures[fixture].configuration(route), targets: { pypi: { name, version } } };
};

/** Load the unchanged caller; the runner passes only the selected module. */
export const loadRecursiveCheckedRecordPythonCaller = async () =>
	readFile(recursiveCheckedRecordPythonCaller, "utf8");

/**
 * Explicit caller arguments for one selection; the source itself never changes.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordPythonCallerArgs = fixture => {
	assert.ok(recursiveCheckedRecordPythonFixtures.includes(fixture));
	return [fixture];
};

/**
 * Require every check and expected rejection for the selected module.
 *
 * @param stdout - Original complete caller output.
 * @param fixture - Independently selected module.
 */
export const parseRecursiveCheckedRecordPythonResult = (stdout, fixture) => {
	assert.ok(recursiveCheckedRecordPythonFixtures.includes(fixture));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, recursiveCheckedRecordPythonCounts[fixture]);
	assert.equal(stdout, `${JSON.stringify(Object.fromEntries(Object.entries(result).sort()))
		.replaceAll(",", ", ").replaceAll(":", ": ")}\n`);
	return result;
};

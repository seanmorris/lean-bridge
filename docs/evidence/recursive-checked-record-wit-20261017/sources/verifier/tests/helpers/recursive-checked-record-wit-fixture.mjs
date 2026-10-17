/**
 * Closed WIT selections and the independently specified recursive checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordConfiguration, recursiveCheckedRecordFixtureRoot
	, recursiveCheckedRecordModule, recursiveCheckedRecordReview
} from "./recursive-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordWitLoadCeiling, recursiveCheckedRecordWitLoadCeilings
} from "./recursive-checked-record-wit-resources.mjs";

export const recursiveCheckedRecordWitRoutes = Object.freeze(["ordinary", "reviewed"]);
export const recursiveCheckedRecordWitFixtures = Object.freeze(["recursive", "mutual"]);
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
export const recursiveCheckedRecordWitCaller
	= "tests/fixtures/recursive-checked-record-consumers/wit-wasi.c";
/** Independent caller totals; both routes run the same caller. */
export const recursiveCheckedRecordWitCounts = Object.freeze({
	recursive: Object.freeze({
		checks: 1068, hostRejections: 75, module: "recursive", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 5, snapshots: 352
	})
	, mutual: Object.freeze({
		checks: 1079, hostRejections: 76, module: "mutual", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 6, snapshots: 356
	})
});

/**
 * Exact WIT package coordinates and C prefix for one module.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordWitPackage = fixture => {
	assert.ok(recursiveCheckedRecordWitFixtures.includes(fixture));
	const name = `${fixture}checkedrecords`;
	return Object.freeze({
		name, version: "1.0.0", prefix: name
		, define: fixture === "mutual" ? "RECURSIVE_CHECKED_RECORD_MUTUAL" : null
		, root: fixtures[fixture].root, leanModule: fixtures[fixture].module
	});
};

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const recursiveCheckedRecordWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid recursive checked-record WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid recursive checked-record WIT ${name}`);
			assert.equal(flag, "1", `Explicit recursive checked-record WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid recursive checked-record WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate recursive checked-record WIT ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid recursive checked-record WIT MAX_LOAD");
	const maxLoad = rawLoad === undefined ? recursiveCheckedRecordWitLoadCeiling : Number(rawLoad);
	assert.ok(recursiveCheckedRecordWitLoadCeilings.includes(maxLoad)
		, `Recursive checked-record WIT max load must be one of ${recursiveCheckedRecordWitLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", recursiveCheckedRecordWitRoutes)
		, fixtures: select("FIXTURES", recursiveCheckedRecordWitFixtures)
		, maxLoad
	};
};

/**
 * Keep every recursive identity, alias and per-site constructor decision.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordWitReview = fixture => {
	assert.ok(recursiveCheckedRecordWitFixtures.includes(fixture));
	return fixtures[fixture].review();
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordWitConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordWitRoutes.includes(route));
	const { name, version } = recursiveCheckedRecordWitPackage(fixture);
	return { ...fixtures[fixture].configuration(route), targets: { "wit-wasi": { name, version } } };
};

/** Load the unchanged caller; only its compile-time module define differs. */
export const loadRecursiveCheckedRecordWitCaller = async () =>
	readFile(recursiveCheckedRecordWitCaller, "utf8");

/**
 * Require every check and expected rejection for the selected module.
 *
 * @param stdout - Original complete caller output.
 * @param fixture - Independently selected module.
 */
export const parseRecursiveCheckedRecordWitResult = (stdout, fixture) => {
	assert.ok(recursiveCheckedRecordWitFixtures.includes(fixture));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, recursiveCheckedRecordWitCounts[fixture]);
	assert.equal(stdout, `${JSON.stringify(Object.fromEntries(Object.entries(result).sort()))}\n`);
	return result;
};

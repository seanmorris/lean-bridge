/**
 * Closed native PHP selections and the independently specified recursive checked-record caller.
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
	recursiveCheckedRecordPhpLoadCeiling, recursiveCheckedRecordPhpLoadCeilings
} from "./recursive-checked-record-php-resources.mjs";

export const recursiveCheckedRecordPhpRoutes = Object.freeze(["ordinary", "reviewed"]);
export const recursiveCheckedRecordPhpFixtures = Object.freeze(["recursive", "mutual"]);
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
export const recursiveCheckedRecordPhpCaller
	= "tests/fixtures/recursive-checked-record-consumers/php-native.php";
/** Independent caller totals; both routes run the same caller. */
export const recursiveCheckedRecordPhpCounts = Object.freeze({
	recursive: Object.freeze({
		checks: 1097, hostRejections: 82, module: "recursive", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 9, snapshots: 499
	})
	, mutual: Object.freeze({
		checks: 1114, hostRejections: 84, module: "mutual", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 12, snapshots: 505
	})
});

/**
 * Exact Composer coordinates for one module.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordPhpPackage = fixture => {
	assert.ok(recursiveCheckedRecordPhpFixtures.includes(fixture));
	const name = `${fixture}checkedrecords`;
	return Object.freeze({
		name: `example/${name}`, version: "1.0.0"
		, namespace: `Lean${name[0].toUpperCase()}${name.slice(1)}`
		, root: fixtures[fixture].root, leanModule: fixtures[fixture].module
	});
};

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const recursiveCheckedRecordPhpSelection = environment => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid recursive checked-record PHP TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid recursive checked-record PHP ${name}`);
			assert.equal(flag, "1", `Explicit recursive checked-record PHP ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid recursive checked-record PHP ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate recursive checked-record PHP ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid recursive checked-record PHP MAX_LOAD");
	const maxLoad = rawLoad === undefined ? recursiveCheckedRecordPhpLoadCeiling : Number(rawLoad);
	assert.ok(recursiveCheckedRecordPhpLoadCeilings.includes(maxLoad)
		, `Recursive checked-record PHP max load must be one of ${recursiveCheckedRecordPhpLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", recursiveCheckedRecordPhpRoutes)
		, fixtures: select("FIXTURES", recursiveCheckedRecordPhpFixtures)
		, maxLoad
	};
};

/**
 * Keep every recursive identity, alias and per-site constructor decision.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordPhpReview = fixture => {
	assert.ok(recursiveCheckedRecordPhpFixtures.includes(fixture));
	return fixtures[fixture].review();
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordPhpConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordPhpRoutes.includes(route));
	const { name, version } = recursiveCheckedRecordPhpPackage(fixture);
	return { ...fixtures[fixture].configuration(route), targets: { "php-native": { name, version } } };
};

/** Load the unchanged caller; the installed package alone selects its module. */
export const loadRecursiveCheckedRecordPhpCaller = async () =>
	readFile(recursiveCheckedRecordPhpCaller, "utf8");

/**
 * Require every check and expected rejection for the selected module.
 *
 * @param stdout - Original complete caller output.
 * @param fixture - Independently selected module.
 */
export const parseRecursiveCheckedRecordPhpResult = (stdout, fixture) => {
	assert.ok(recursiveCheckedRecordPhpFixtures.includes(fixture));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, recursiveCheckedRecordPhpCounts[fixture]);
	assert.equal(stdout, `${JSON.stringify(Object.fromEntries(Object.entries(result).sort()))}\n`);
	return result;
};

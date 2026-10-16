/**
 * Closed Ruby selections and the independently specified recursive checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	recursiveCheckedRecordConfiguration, recursiveCheckedRecordFixtureRoot
	, recursiveCheckedRecordModule, recursiveCheckedRecordReview
} from "./recursive-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordRubyLoadCeiling, recursiveCheckedRecordRubyLoadCeilings
} from "./recursive-checked-record-ruby-resources.mjs";

export const recursiveCheckedRecordRubyRoutes = Object.freeze(["ordinary", "reviewed"]);
// MutualCheckedRecords joins once Ruby can represent its Envelope.next field.
export const recursiveCheckedRecordRubyFixtures = Object.freeze(["recursive"]);
export const recursiveCheckedRecordRubyCaller
	= "tests/fixtures/recursive-checked-record-consumers/ruby.rb";
/** Independent caller totals; both routes run the same caller. */
export const recursiveCheckedRecordRubyCounts = Object.freeze({
	recursive: Object.freeze({
		checks: 1083, hostRejections: 78, module: "recursive", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 8, snapshots: 495
	})
});

/**
 * Exact gem coordinates for one module.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordRubyPackage = fixture => {
	assert.ok(recursiveCheckedRecordRubyFixtures.includes(fixture));
	const name = `${fixture}checkedrecords`;
	return Object.freeze({
		name, version: "1.0.0", requirePath: `lean_bridge/${name}`
		, namespace: `LeanBridge::${name[0].toUpperCase()}${name.slice(1)}`
		, root: recursiveCheckedRecordFixtureRoot
		, leanModule: recursiveCheckedRecordModule
	});
};

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const recursiveCheckedRecordRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid recursive checked-record Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid recursive checked-record Ruby ${name}`);
			assert.equal(flag, "1", `Explicit recursive checked-record Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid recursive checked-record Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate recursive checked-record Ruby ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid recursive checked-record Ruby MAX_LOAD");
	const maxLoad = rawLoad === undefined ? recursiveCheckedRecordRubyLoadCeiling : Number(rawLoad);
	assert.ok(recursiveCheckedRecordRubyLoadCeilings.includes(maxLoad)
		, `Recursive checked-record Ruby max load must be one of ${recursiveCheckedRecordRubyLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", recursiveCheckedRecordRubyRoutes)
		, fixtures: select("FIXTURES", recursiveCheckedRecordRubyFixtures)
		, maxLoad
	};
};

/**
 * Keep every recursive identity, alias and per-site constructor decision.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordRubyReview = fixture => {
	assert.ok(recursiveCheckedRecordRubyFixtures.includes(fixture));
	return recursiveCheckedRecordReview();
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordRubyConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordRubyRoutes.includes(route));
	const { name, version } = recursiveCheckedRecordRubyPackage(fixture);
	return { ...recursiveCheckedRecordConfiguration(route), targets: { rubygems: { name, version } } };
};

/** Load the unchanged caller; the runner passes only the selected module. */
export const loadRecursiveCheckedRecordRubyCaller = async () =>
	readFile(recursiveCheckedRecordRubyCaller, "utf8");

/**
 * Explicit caller arguments for one selection; the source itself never changes.
 *
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordRubyCallerArgs = fixture => {
	assert.ok(recursiveCheckedRecordRubyFixtures.includes(fixture));
	return [fixture];
};

/**
 * Require every check and expected rejection for the selected module.
 *
 * @param stdout - Original complete caller output.
 * @param fixture - Independently selected module.
 */
export const parseRecursiveCheckedRecordRubyResult = (stdout, fixture) => {
	assert.ok(recursiveCheckedRecordRubyFixtures.includes(fixture));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, recursiveCheckedRecordRubyCounts[fixture]);
	assert.equal(stdout, `${JSON.stringify(Object.fromEntries(Object.entries(result).sort()))}\n`);
	return result;
};

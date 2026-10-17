/**
 * Closed Rust selections and the independently specified recursive checked-record caller.
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
	recursiveCheckedRecordRustLoadCeiling, recursiveCheckedRecordRustLoadCeilings
} from "./recursive-checked-record-rust-resources.mjs";

export const recursiveCheckedRecordRustRoutes = Object.freeze(["ordinary", "reviewed"]);
export const recursiveCheckedRecordRustFixtures = Object.freeze(["recursive", "mutual"]);
export const recursiveCheckedRecordRustCaller
	= "tests/fixtures/recursive-checked-record-consumers/rust.rs";
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

// Filled from the independent caller and kept exact by parseRecursiveCheckedRecordRustResult.
export const recursiveCheckedRecordRustCounts = Object.freeze({
	recursive: Object.freeze({
		checks: 908, limitRejections: 1, module: "recursive", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 5, snapshots: 417
	})
	, mutual: Object.freeze({
		checks: 915, limitRejections: 1, module: "mutual", recoveries: 64
		, rejections: 144, rounds: 64, snapshotControls: 6, snapshots: 420
	})
});

/**
 * Exact crate coordinates for one recursive graph.
 *
 * @param fixture - Recursive or mutually recursive graph.
 */
export const recursiveCheckedRecordRustPackage = fixture => {
	assert.ok(recursiveCheckedRecordRustFixtures.includes(fixture));
	return Object.freeze({
		name: `${fixture}checkedrecords`, version: "1.0.0"
		, root: fixtures[fixture].root, leanModule: fixtures[fixture].module
	});
};

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const recursiveCheckedRecordRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUST_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid recursive checked-record Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid recursive checked-record Rust ${name}`);
			assert.equal(flag, "1", `Explicit recursive checked-record Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid recursive checked-record Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate recursive checked-record Rust ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string", "Invalid recursive checked-record Rust MAX_LOAD");
	const maxLoad = rawLoad === undefined ? recursiveCheckedRecordRustLoadCeiling : Number(rawLoad);
	assert.ok(recursiveCheckedRecordRustLoadCeilings.includes(maxLoad)
		, `Recursive checked-record Rust max load must be one of ${recursiveCheckedRecordRustLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", recursiveCheckedRecordRustRoutes)
		, fixtures: select("FIXTURES", recursiveCheckedRecordRustFixtures)
		, maxLoad
	};
};

/**
 * Keep every recursive identity, alias and per-site constructor decision.
 *
 * @param fixture - Recursive or mutually recursive graph.
 */
export const recursiveCheckedRecordRustReview = fixture => {
	assert.ok(recursiveCheckedRecordRustFixtures.includes(fixture));
	return fixtures[fixture].review();
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param fixture - Recursive or mutually recursive graph.
 */
export const recursiveCheckedRecordRustConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordRustRoutes.includes(route));
	const { name, version } = recursiveCheckedRecordRustPackage(fixture);
	return { ...fixtures[fixture].configuration(route), targets: { cargo: { name, version } } };
};

/** Load the unchanged caller; Cargo features select only its graph shape. */
export const loadRecursiveCheckedRecordRustCaller = async () =>
	readFile(recursiveCheckedRecordRustCaller, "utf8");

/**
 * Consumer Cargo features for one selection.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param fixture - Recursive or mutually recursive graph.
 */
export const recursiveCheckedRecordRustFeatures = (route, fixture) => {
	assert.ok(recursiveCheckedRecordRustRoutes.includes(route));
	assert.ok(recursiveCheckedRecordRustFixtures.includes(fixture));
	return [
		...fixture === "mutual" ? ["mutual"] : []
		, ...route === "reviewed" ? ["reviewed"] : []
	];
};

/**
 * Require every check and expected rejection for the selected graph.
 *
 * @param stdout - Original complete caller output.
 * @param fixture - Recursive or mutually recursive graph.
 */
export const parseRecursiveCheckedRecordRustResult = (stdout, fixture) => {
	assert.ok(recursiveCheckedRecordRustFixtures.includes(fixture));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, recursiveCheckedRecordRustCounts[fixture]);
	return result;
};

/**
 * Closed Ruby selections for proof-erased dependent checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordFixture
	, dependentCheckedRecordName
	, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordRubyRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordRubyTarget = Object.freeze({
	name: dependentCheckedRecordName, version: "1.0.0"
});
export const dependentCheckedRecordRubyRequirePath
	= `lean_bridge/${dependentCheckedRecordName}`;
export const dependentCheckedRecordRubyNamespace = "LeanBridge::Dependentrecords";
export const dependentCheckedRecordRubyFixtureRoot = dependentCheckedRecordFixture;
export const dependentCheckedRecordRubyLeanModule = "DependentRecords";
export const dependentCheckedRecordRubyModes = Object.freeze(["full", "result-only"]);
export const dependentCheckedRecordRubyCounts = Object.freeze({
	full: Object.freeze({ calls: 1289, checks: 2326, recoveries: 258
		, rejections: 258, snapshots: 1289 })
	, "result-only": Object.freeze({ calls: 513, checks: 516, recoveries: 0
		, rejections: 0, snapshots: 513 })
});

/**
 * Reject disabled, duplicate, or partial host selections before any build.
 *
 * @param environment - Explicit host environment.
 */
export const dependentCheckedRecordRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid dependent checked-record Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid dependent checked-record Ruby ${name}`);
			assert.equal(flag, "1", `Explicit dependent checked-record Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid dependent checked-record Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate dependent checked-record Ruby ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid dependent checked-record Ruby MAX_LOAD");
	const maxLoad = rawLoad === undefined ? environment.CI === "true" ? 8 : 12 : Number(rawLoad);
	assert.ok([8, 12, 16, 20].includes(maxLoad), "Dependent checked-record Ruby max load must be 8, 12, 16, or 20");
	assert.equal(environment[prefix + "MODES"], undefined
		, "Dependent checked-record Ruby modes are encoded by the selected route");
	return { enabled: flag === "1"
		, routes: select("ROUTES", dependentCheckedRecordRubyRoutes), maxLoad };
};

/**
 * Select exactly one ordinary/reviewed and full/result-only Ruby gem build.
 *
 * @param route - Exact independent author route.
 */
export const dependentCheckedRecordRubyConfiguration = route => {
	assert.ok(dependentCheckedRecordRubyRoutes.includes(route), "Unknown dependent checked-record Ruby route");
	const selection = dependentCheckedRecordSelection(route);
	return { ...selection.configuration, targets: { rubygems: dependentCheckedRecordRubyTarget } };
};

/** Load an immutable caller independent of generated Ruby package output. */
export const dependentCheckedRecordRubyCaller = () => readFile(
	"tests/fixtures/dependent-checked-record-consumers/ruby.rb", "utf8");

/**
 * Preserve only route-derived switches at process launch.
 *
 * @param route - Exact independent author route.
 */
export const dependentCheckedRecordRubyCallerArgs = route => {
	assert.ok(dependentCheckedRecordRubyRoutes.includes(route), "Unknown dependent checked-record Ruby route");
	const { resultOnly, reviewed } = dependentCheckedRecordSelection(route);
	return [...resultOnly ? ["--result-only"] : [], ...reviewed ? ["--reviewed"] : []];
};

/**
 * Require the complete, independent caller receipt for its exact API mode.
 *
 * @param stdout - Complete immutable caller output.
 * @param mode - Full API or constructor-free results only.
 */
export const parseDependentCheckedRecordRubyResult = (stdout, mode) => {
	assert.ok(dependentCheckedRecordRubyModes.includes(mode));
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, dependentCheckedRecordRubyCounts[mode]);
	return result;
};

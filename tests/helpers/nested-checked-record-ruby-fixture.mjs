/**
 * Closed Ruby selections and the independently specified nested checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordName, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordRubyRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordRubyModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordRubyTarget = Object.freeze({ name: nestedCheckedRecordName, version: "1.0.0" });
/** Independent caller totals; result-only replays only the constructor-free producers. */
export const nestedCheckedRecordRubyCounts = Object.freeze({
	full: Object.freeze({ checks: 5001, rejections: 525, hostRejections: 15, recoveries: 256, snapshots: 1839, snapshotControls: 11, rounds: 256 })
	, "result-only": Object.freeze({ checks: 1571, rejections: 0, hostRejections: 4, recoveries: 0, snapshots: 518, snapshotControls: 8, rounds: 256 })
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const nestedCheckedRecordRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nested checked-record Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record Ruby ${name}`);
			assert.equal(flag, "1", `Explicit nested checked-record Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nested checked-record Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nested checked-record Ruby ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", `Explicit ${prefix}OUTPUT requires TEST=1`);
	return { enabled: flag === "1", routes: select("ROUTES", nestedCheckedRecordRubyRoutes), modes: select("MODES", nestedCheckedRecordRubyModes) };
};

/**
 * Keep every nested checked-record identity and per-site constructor decision.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nestedCheckedRecordRubyReview = mode => {
	assert.ok(nestedCheckedRecordRubyModes.includes(mode)); return nestedCheckedRecordReview(mode);
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nestedCheckedRecordRubyConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordRubyRoutes.includes(route)); assert.ok(nestedCheckedRecordRubyModes.includes(mode));
	return { ...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: { rubygems: { ...nestedCheckedRecordRubyTarget } } };
};

/**
 * Load the unchanged caller; the runner passes the explicit author route and mode.
 *
 * @param route - Explicit source route.
 */
export const nestedCheckedRecordRubyCaller = async route => {
	assert.ok(nestedCheckedRecordRubyRoutes.includes(route));
	return readFile("tests/fixtures/nested-checked-record-consumers/ruby.rb", "utf8");
};

/**
 * Explicit caller arguments for one selection; the source itself never changes.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full or standalone result-only API.
 */
export const nestedCheckedRecordRubyCallerArgs = (route, mode) => {
	assert.ok(nestedCheckedRecordRubyRoutes.includes(route)); assert.ok(nestedCheckedRecordRubyModes.includes(mode));
	return [...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []];
};

/**
 * Require every check and expected rejection for the selected API.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package mode.
 */
export const parseNestedCheckedRecordRubyResult = (stdout, mode) => {
	assert.ok(nestedCheckedRecordRubyModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nestedCheckedRecordRubyCounts[mode]);
	return result;
};

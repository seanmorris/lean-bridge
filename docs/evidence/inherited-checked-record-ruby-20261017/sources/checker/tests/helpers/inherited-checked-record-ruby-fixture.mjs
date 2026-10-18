/**
 * Closed Ruby selections and an independently specified inherited checked-
 * record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordName
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordRubyLoadCeilings
} from "./inherited-checked-record-ruby-resources.mjs";

export { inheritedCheckedRecordRubyLoadCeilings };

export const inheritedCheckedRecordRubyRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordRubyModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordRubyTarget = Object.freeze({
	name: inheritedCheckedRecordName, version: "1.0.0"
});
export const inheritedCheckedRecordRubyCounts = Object.freeze({
	full: Object.freeze({
		checks: 7240, rejections: 1288, hostRejections: 7
		, calls: 3355, recoveries: 256, snapshots: 3355
		, snapshotControls: 8, rounds: 256
	})
	, "result-only": Object.freeze({
		checks: 1570, rejections: 0, hostRejections: 4
		, calls: 522, recoveries: 0, snapshots: 522
		, snapshotControls: 6, rounds: 256
	})
});

/**
 * Reject disabled explicit selections, spelling errors, and duplicate work.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const inheritedCheckedRecordRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUBY_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record Ruby ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record Ruby ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record Ruby MAX_LOAD");
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 8 : 12
		: Number(rawLoad);
	assert.ok(inheritedCheckedRecordRubyLoadCeilings.includes(maxLoad)
		, "Inherited checked-record Ruby max load must be 8, 12, 16, or 20");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordRubyRoutes)
		, modes: select("MODES", inheritedCheckedRecordRubyModes), maxLoad
	};
};

/**
 * Keep the complete API or only constructor-free result exports.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordRubyReview = mode => {
	assert.ok(inheritedCheckedRecordRubyModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item =>
		names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select a reproducible gem without changing author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordRubyConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordRubyRoutes.includes(route));
	assert.ok(inheritedCheckedRecordRubyModes.includes(mode));
	const configuration = inheritedCheckedRecordConfiguration(route, ["c"]);
	if(mode === "result-only")
	{
		const names = new Set([
			"InheritedCheckedRecords.produce"
			, "InheritedCheckedRecords.produceStamped"
		]);
		if(configuration.exports)
			configuration.exports = configuration.exports.filter(name =>
				names.has(name));
		if(configuration.contracts)
		{
			configuration.contracts = Object.fromEntries(
				Object.entries(configuration.contracts)
					.filter(([name]) => names.has(name))
			);
			if(!Object.keys(configuration.contracts).length)
				delete configuration.contracts;
		}
	}
	return {
		...configuration
		, targets: { rubygems: { ...inheritedCheckedRecordRubyTarget } }
	};
};

/**
 * Load the unchanged independent caller for either author route.
 *
 * @param route - Ordinary or reviewed diagnostic vocabulary.
 */
export const inheritedCheckedRecordRubyCaller = async route => {
	assert.ok(inheritedCheckedRecordRubyRoutes.includes(route));
	return readFile(
		"tests/fixtures/inherited-checked-record-consumers/ruby.rb", "utf8");
};

/**
 * Select only mode and route diagnostics at process launch.
 *
 * @param route - Ordinary or reviewed diagnostic vocabulary.
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordRubyCallerArgs = (route, mode) => {
	assert.ok(inheritedCheckedRecordRubyRoutes.includes(route));
	assert.ok(inheritedCheckedRecordRubyModes.includes(mode));
	return [
		...mode === "result-only" ? ["--result-only"] : []
		, ...route === "reviewed" ? ["--reviewed"] : []
	];
};

/**
 * Require every independently counted check and rejection.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected API mode.
 */
export const parseInheritedCheckedRecordRubyResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordRubyModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordRubyCounts[mode]);
	return result;
};

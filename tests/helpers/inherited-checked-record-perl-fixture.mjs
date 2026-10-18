/**
 * Closed Perl selections and an independently specified inherited checked-
 * record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";

export const inheritedCheckedRecordPerlRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordPerlModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordPerlLoadCeilings = Object.freeze([
	8, 12, 16, 20
]);
export const inheritedCheckedRecordPerlTarget = Object.freeze({
	module: "LeanBridge::InheritedCheckedRecords", version: "1.000"
});
export const inheritedCheckedRecordPerlCallerPath
	= "tests/fixtures/inherited-checked-record-consumers/perl.pl";
export const inheritedCheckedRecordPerlCounts = Object.freeze({
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
export const inheritedCheckedRecordPerlSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record Perl TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record Perl ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record Perl ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record Perl ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record Perl ${name}`);
		return selected;
	};
	for(const name of [
		prefix + "OUTPUT", prefix + "MAX_LOAD"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERLS"
	]) if(environment[name] !== undefined)
		assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record Perl MAX_LOAD");
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 8 : 12
		: Number(rawLoad);
	assert.ok(inheritedCheckedRecordPerlLoadCeilings.includes(maxLoad)
		, "Inherited checked-record Perl max load must be 8, 12, 16, or 20");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordPerlRoutes)
		, modes: select("MODES", inheritedCheckedRecordPerlModes), maxLoad
	};
};

/**
 * Keep the complete API or only constructor-free result exports.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPerlReview = mode => {
	assert.ok(inheritedCheckedRecordPerlModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item =>
		names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select a reproducible CPAN package without changing author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPerlConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordPerlRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPerlModes.includes(mode));
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
		, targets: { cpan: { ...inheritedCheckedRecordPerlTarget } }
	};
};

/** Load the unchanged independent caller for either author route. */
export const inheritedCheckedRecordPerlCaller = () =>
	readFile(inheritedCheckedRecordPerlCallerPath, "utf8");

/**
 * Select API breadth and diagnostic parameter names without rewriting source.
 *
 * @param route - Ordinary or reviewed diagnostic vocabulary.
 * @param mode - Full or constructor-free result-only API.
 */
export const inheritedCheckedRecordPerlCallerArgs = (route, mode) => {
	assert.ok(inheritedCheckedRecordPerlRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPerlModes.includes(mode));
	return [
		...mode === "result-only" ? ["--result-only"] : []
		, ...route === "reviewed" ? ["--reviewed"] : []
	];
};

/**
 * Require every independently fixed result counter.
 *
 * @param stdout - Complete caller output.
 * @param mode - Full or constructor-free result-only API.
 */
export const parseInheritedCheckedRecordPerlResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordPerlModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordPerlCounts[mode]);
	return result;
};

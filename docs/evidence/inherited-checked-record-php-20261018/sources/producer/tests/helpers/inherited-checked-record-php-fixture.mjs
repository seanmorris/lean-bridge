/**
 * Independently specified PHP caller for inherited checked records.
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

export const inheritedCheckedRecordPhpRoutes = Object.freeze(["ordinary", "reviewed"]);
export const inheritedCheckedRecordPhpModes = Object.freeze(["full", "result-only"]);
export const inheritedCheckedRecordPhpLoadCeilings = Object.freeze([8, 12, 16, 20]);
export const inheritedCheckedRecordPhpTarget = Object.freeze({
	name: `example/${inheritedCheckedRecordName}`, version: "1.0.0"
});
/** The caller fixes these totals independently of generated package metadata. */
export const inheritedCheckedRecordPhpCounts = Object.freeze({
	full: Object.freeze({
		checks: 5680, rejections: 1291, calls: 2839
		, snapshots: 2839, recoveries: 256, rounds: 256
	})
	, "result-only": Object.freeze({
		checks: 1042, rejections: 0, calls: 518
		, snapshots: 518, recoveries: 0, rounds: 256
	})
});

/**
 * Reject disabled explicit selections, spelling errors, and duplicate work.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const inheritedCheckedRecordPhpSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record PHP TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record PHP ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record PHP ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record PHP ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record PHP ${name}`);
		return selected;
	};
	for(const name of ["OUTPUT", "MAX_LOAD"])
		if(environment[prefix + name] !== undefined)
			assert.equal(flag, "1"
				, `Explicit inherited checked-record PHP ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record PHP MAX_LOAD");
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(inheritedCheckedRecordPhpLoadCeilings.includes(maxLoad)
		, "Inherited checked-record PHP max load must be 8, 12, 16, or 20");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordPhpRoutes)
		, modes: select("MODES", inheritedCheckedRecordPhpModes)
		, maxLoad
	};
};

/**
 * Keep the complete API or only constructor-free result exports.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPhpReview = mode => {
	assert.ok(inheritedCheckedRecordPhpModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item => names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select a reproducible Composer package without changing author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPhpConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordPhpRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPhpModes.includes(mode));
	const configuration = inheritedCheckedRecordConfiguration(route, ["c"]);
	if(mode === "result-only")
	{
		const names = new Set([
			"InheritedCheckedRecords.produce"
			, "InheritedCheckedRecords.produceStamped"
		]);
		if(configuration.exports)
			configuration.exports = configuration.exports.filter(name => names.has(name));
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
		, targets: { "php-native": { ...inheritedCheckedRecordPhpTarget } }
	};
};

/**
 * Select API breadth and diagnostic parameter names through two fixed constants.
 *
 * @param route - Ordinary or independently reviewed source route.
 * @param mode - Full or constructor-free result-only API.
 */
export const inheritedCheckedRecordPhpCaller = async (route, mode) => {
	assert.ok(inheritedCheckedRecordPhpRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPhpModes.includes(mode));
	let source = await readFile(
		"tests/fixtures/inherited-checked-record-consumers/php-native.php", "utf8"
	);
	const selections = [
		"const INHERITED_CHECKED_RECORD_RESULT_ONLY = false;"
		, "const INHERITED_PARAMETER_PREFIX = 'arg';"
	];
	for(const selection of selections)
		assert.equal(source.split(selection).length, 2, selection);
	if(mode === "result-only") source = source.replace(
		selections[0], "const INHERITED_CHECKED_RECORD_RESULT_ONLY = true;"
	);
	if(route === "reviewed") source = source.replace(
		selections[1], "const INHERITED_PARAMETER_PREFIX = 'value';"
	);
	return source;
};

/**
 * Require every independently fixed result counter.
 *
 * @param stdout - Complete caller output.
 * @param mode - Full or constructor-free result-only API.
 */
export const parseInheritedCheckedRecordPhpResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordPhpModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordPhpCounts[mode]);
	return result;
};

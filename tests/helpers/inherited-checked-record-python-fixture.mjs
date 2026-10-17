/**
 * Closed Python selections and an independently specified inherited checked-
 * record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordName
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";

export const inheritedCheckedRecordPythonRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordPythonModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordPythonMinors = Object.freeze([
	"3.11", "3.12"
]);
export const inheritedCheckedRecordPythonPackage
	= "lean_" + inheritedCheckedRecordName;
export const inheritedCheckedRecordPythonTarget = Object.freeze({
	name: inheritedCheckedRecordName, version: "1.0.0"
});
export const inheritedCheckedRecordPythonCounts = Object.freeze({
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
export const inheritedCheckedRecordPythonSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PYTHON_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record Python ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record Python ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record Python ${name}`);
		return selected;
	};
	for(const name of [
		prefix + "OUTPUT", prefix + "MAX_LOAD"
		, "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PYTHONS"
	]) if(environment[name] !== undefined)
		assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record Python MAX_LOAD");
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10
		: Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Inherited checked-record Python max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordPythonRoutes)
		, modes: select("MODES", inheritedCheckedRecordPythonModes), maxLoad
	};
};

/**
 * Require both distinct supported CPython floor executables.
 *
 * @param raw - JSON map from minor version to absolute executable.
 */
export const inheritedCheckedRecordPythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), inheritedCheckedRecordPythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value)
			&& !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, 2
		, "Select distinct Python executables");
	return Object.fromEntries(inheritedCheckedRecordPythonMinors.map(minor =>
		[minor, values[minor]]));
};

/**
 * Keep the complete API or only constructor-free result exports.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPythonReview = mode => {
	assert.ok(inheritedCheckedRecordPythonModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item =>
		names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select a reproducible wheel without changing author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPythonConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordPythonRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPythonModes.includes(mode));
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
		, targets: { pypi: { ...inheritedCheckedRecordPythonTarget } }
	};
};

/**
 * Load the unchanged independent caller for either author route.
 *
 * @param route - Ordinary or reviewed diagnostic vocabulary.
 */
export const inheritedCheckedRecordPythonCaller = async route => {
	assert.ok(inheritedCheckedRecordPythonRoutes.includes(route));
	return readFile(
		"tests/fixtures/inherited-checked-record-consumers/python.py", "utf8");
};

/**
 * Select only mode and route diagnostics at process launch.
 *
 * @param route - Ordinary or reviewed diagnostic vocabulary.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordPythonCallerArgs = (route, mode) => {
	assert.ok(inheritedCheckedRecordPythonRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPythonModes.includes(mode));
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
export const parseInheritedCheckedRecordPythonResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordPythonModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordPythonCounts[mode]);
	return result;
};

/**
 * Closed WIT selections and independent caller for inherited checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordModule
	, inheritedCheckedRecordName
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordWitLoadCeiling
	, inheritedCheckedRecordWitLoadCeilings
} from "./inherited-checked-record-wit-resources.mjs";

export const inheritedCheckedRecordWitRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordWitModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordWitTarget = Object.freeze({
	name: inheritedCheckedRecordName, version: "1.0.0"
});
export const inheritedCheckedRecordWitCounts = Object.freeze({
	full: Object.freeze({
		checks: 11592, rejections: 1286, hostRejections: 7
		, recoveries: 256, snapshots: 3604, rounds: 256
	})
	, "result-only": Object.freeze({
		checks: 1553, rejections: 0, hostRejections: 4
		, recoveries: 0, snapshots: 516, rounds: 256
	})
});

/**
 * Refuse misspelled gates and ambiguous route/mode selections.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const inheritedCheckedRecordWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_WIT_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record WIT ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record WIT ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
	{
		assert.equal(flag, "1", `Explicit ${prefix}OUTPUT requires TEST=1`);
		assert.ok(typeof environment[prefix + "OUTPUT"] === "string"
			&& environment[prefix + "OUTPUT"].length > 0);
	}
	if(environment[prefix + "MAX_LOAD"] !== undefined)
		assert.equal(flag, "1", `Explicit ${prefix}MAX_LOAD requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? inheritedCheckedRecordWitLoadCeiling : Number(rawLoad);
	assert.ok(inheritedCheckedRecordWitLoadCeilings.includes(maxLoad)
		, `Inherited checked-record WIT max load must be one of ${inheritedCheckedRecordWitLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordWitRoutes)
		, modes: select("MODES", inheritedCheckedRecordWitModes)
		, maxLoad
	};
};

/**
 * Keep the full independent review or only constructor-free results.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordWitReview = mode => {
	assert.ok(inheritedCheckedRecordWitModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item => names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select WIT packaging while retaining ordinary or reviewed author authority.
 *
 * @param route - Ordinary or independently reviewed author route.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordWitConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordWitRoutes.includes(route));
	assert.ok(inheritedCheckedRecordWitModes.includes(mode));
	const configuration = inheritedCheckedRecordConfiguration(route, ["c"]);
	if(mode === "result-only")
	{
		const names = new Set([
			`${inheritedCheckedRecordModule}.produce`
			, `${inheritedCheckedRecordModule}.produceStamped`
		]);
		if(configuration.exports)
			configuration.exports = configuration.exports.filter(name => names.has(name));
		if(configuration.contracts)
		{
			configuration.contracts = Object.fromEntries(
				Object.entries(configuration.contracts).filter(([name]) => names.has(name))
			);
			if(!Object.keys(configuration.contracts).length)
				delete configuration.contracts;
		}
	}
	return {
		...configuration
		, targets: { "wit-wasi": { ...inheritedCheckedRecordWitTarget } }
	};
};

/**
 * Inline the checked-in value helpers into one source-free C consumer.
 *
 * @param route - Ordinary or independently reviewed diagnostic names.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordWitCaller = async (route, mode) => {
	assert.ok(inheritedCheckedRecordWitRoutes.includes(route));
	assert.ok(inheritedCheckedRecordWitModes.includes(mode));
	const root = "tests/fixtures/inherited-checked-record-consumers/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"';
	assert.equal(source.split(include).length, 2);
	const header = await readFile(root + "wit-values.h", "utf8");
	source = source.replace(include, () => header);
	return inheritedCheckedRecordWitCallerDirectives(route, mode) + source;
};

/**
 * Prepend-only directives shared by the public caller and its source-only model.
 *
 * @param route - Ordinary or independently reviewed diagnostic names.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordWitCallerDirectives = (route, mode) => {
	assert.ok(inheritedCheckedRecordWitRoutes.includes(route));
	assert.ok(inheritedCheckedRecordWitModes.includes(mode));
	return (mode === "result-only"
		? "#define INHERITED_CHECKED_RECORD_RESULT_ONLY\n" : "")
		+ (route === "reviewed"
			? '#define INHERITED_PARAMETER_PREFIX "value"\n' : "");
};

/**
 * Require every independently fixed result counter.
 *
 * @param stdout - Complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseInheritedCheckedRecordWitResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordWitModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordWitCounts[mode]);
	return result;
};

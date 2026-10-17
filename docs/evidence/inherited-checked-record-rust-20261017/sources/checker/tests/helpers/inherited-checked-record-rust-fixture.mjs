/**
 * Closed Rust selections and the independent inherited checked-record caller.
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
	inheritedCheckedRecordRustLoadCeiling
	, inheritedCheckedRecordRustLoadCeilings
} from "./inherited-checked-record-rust-resources.mjs";

export const inheritedCheckedRecordRustRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const inheritedCheckedRecordRustModes = Object.freeze([
	"full", "result-only"
]);
export const inheritedCheckedRecordRustTarget = Object.freeze({
	name: inheritedCheckedRecordName, version: "1.0.0"
});
export const inheritedCheckedRecordRustCounts = Object.freeze({
	full: Object.freeze({
		checks: 7204, rejections: 1286, recoveries: 256
		, snapshots: 3342, snapshotControls: 8, rounds: 256
	})
	, "result-only": Object.freeze({
		checks: 1546, rejections: 0, recoveries: 0
		, snapshots: 514, snapshotControls: 6, rounds: 256
	})
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const inheritedCheckedRecordRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record Rust ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value))
		, `Invalid inherited checked-record Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record Rust ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined)
		assert.equal(typeof rawLoad, "string"
			, "Invalid inherited checked-record Rust MAX_LOAD");
	const maxLoad = rawLoad === undefined
		? inheritedCheckedRecordRustLoadCeiling : Number(rawLoad);
	assert.ok(inheritedCheckedRecordRustLoadCeilings.includes(maxLoad)
		, `Inherited checked-record Rust max load must be one of ${inheritedCheckedRecordRustLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", inheritedCheckedRecordRustRoutes)
		, modes: select("MODES", inheritedCheckedRecordRustModes)
		, maxLoad
	};
};

/**
 * Keep the full independent review or only constructor-free results.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordRustReview = mode => {
	assert.ok(inheritedCheckedRecordRustModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	const names = new Set(["produce", "produceStamped"]);
	review.declarations = review.declarations.filter(item => names.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Select Cargo packaging while retaining ordinary or reviewed author authority.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordRustConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordRustRoutes.includes(route));
	assert.ok(inheritedCheckedRecordRustModes.includes(mode));
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
				Object.entries(configuration.contracts)
					.filter(([name]) => names.has(name))
			);
			if(!Object.keys(configuration.contracts).length)
				delete configuration.contracts;
		}
	}
	return {
		...configuration
		, targets: { cargo: { ...inheritedCheckedRecordRustTarget } }
	};
};

/**
 * Load one unchanged caller; Cargo features select route and API mode.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 */
export const inheritedCheckedRecordRustCaller = async route => {
	assert.ok(inheritedCheckedRecordRustRoutes.includes(route));
	return readFile("tests/fixtures/inherited-checked-record-consumers/rust.rs", "utf8");
};

/**
 * Consumer Cargo features for one explicit selection.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full API or standalone constructor-free results.
 */
export const inheritedCheckedRecordRustFeatures = (route, mode) => {
	assert.ok(inheritedCheckedRecordRustRoutes.includes(route));
	assert.ok(inheritedCheckedRecordRustModes.includes(mode));
	return [
		...mode === "result-only" ? ["result-only"] : []
		, ...route === "reviewed" ? ["reviewed"] : []
	];
};

/**
 * Require every check, expected rejection and snapshot control.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseInheritedCheckedRecordRustResult = (stdout, mode) => {
	assert.ok(inheritedCheckedRecordRustModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, inheritedCheckedRecordRustCounts[mode]);
	return result;
};

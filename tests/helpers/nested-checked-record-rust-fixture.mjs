/**
 * Closed Rust selections and the independent nested checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordName, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordRustRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordRustModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordRustTarget = Object.freeze({ name: nestedCheckedRecordName, version: "1.0.0" });
/** Independent caller totals; result-only replays only the constructor-free producers. */
export const nestedCheckedRecordRustCounts = Object.freeze({
	full: Object.freeze({ checks: 3914, rejections: 525, recoveries: 256, snapshots: 1824, snapshotControls: 9, rounds: 256 })
	, "result-only": Object.freeze({ checks: 1291, rejections: 0, recoveries: 0, snapshots: 514, snapshotControls: 7, rounds: 256 })
});

/**
 * Reject disabled explicit selections, unknown values and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nestedCheckedRecordRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nested checked-record Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record Rust ${name}`);
			assert.equal(flag, "1", `Explicit nested checked-record Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nested checked-record Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nested checked-record Rust ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nested checked-record Rust OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nestedCheckedRecordRustRoutes), modes: select("MODES", nestedCheckedRecordRustModes) };
};

/**
 * Keep every nested checked-record identity and per-site constructor decision.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nestedCheckedRecordRustReview = mode => {
	assert.ok(nestedCheckedRecordRustModes.includes(mode)); return nestedCheckedRecordReview(mode);
};

/**
 * Keep the complete common author contract and select the native Rust crate.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nestedCheckedRecordRustConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordRustRoutes.includes(route)); assert.ok(nestedCheckedRecordRustModes.includes(mode));
	return { ...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: { cargo: { ...nestedCheckedRecordRustTarget } } };
};

/**
 * Preserve one unchanged caller; Cargo features select the route and API.
 *
 * @param route - Explicit ordinary or reviewed source route.
 */
export const nestedCheckedRecordRustCaller = async route => {
	assert.ok(nestedCheckedRecordRustRoutes.includes(route));
	return readFile("tests/fixtures/nested-checked-record-consumers/rust.rs", "utf8");
};

/**
 * Consumer Cargo features for one selection.
 *
 * @param route - Ordinary or reviewed diagnostic names.
 * @param mode - Full or standalone result-only API.
 */
export const nestedCheckedRecordRustFeatures = (route, mode) => {
	assert.ok(nestedCheckedRecordRustRoutes.includes(route)); assert.ok(nestedCheckedRecordRustModes.includes(mode));
	return [...mode === "result-only" ? ["result-only"] : [], ...route === "reviewed" ? ["reviewed"] : []];
};

/**
 * Require every check, expected rejection and independent snapshot control.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNestedCheckedRecordRustResult = (stdout, mode) => {
	assert.ok(nestedCheckedRecordRustModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nestedCheckedRecordRustCounts[mode]); return result;
};

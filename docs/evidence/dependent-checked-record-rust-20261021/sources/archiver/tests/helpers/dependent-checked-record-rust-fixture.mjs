/**
 * Closed Rust selections for proof-erased dependent checked records.
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

export const dependentCheckedRecordRustRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordRustTarget = Object.freeze({
	name: dependentCheckedRecordName, version: "1.0.0"
});
export const dependentCheckedRecordRustFixtureRoot = dependentCheckedRecordFixture;
export const dependentCheckedRecordRustLeanModule = "DependentRecords";
export const dependentCheckedRecordRustModes = Object.freeze(["full", "result-only"]);
export const dependentCheckedRecordRustCounts = Object.freeze({
	full: Object.freeze({ calls: 1289, checks: 2068, recoveries: 258
		, rejections: 258, snapshots: 1289 })
	, "result-only": Object.freeze({ calls: 513, checks: 516, recoveries: 0
		, rejections: 0, snapshots: 513 })
});

/**
 * Reject disabled, duplicate, partial, and mode-mismatched host selections.
 * Result-only is encoded in the author route, never as an independent switch.
 *
 * @param environment - Explicit host environment.
 */
export const dependentCheckedRecordRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid dependent checked-record Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid dependent checked-record Rust ${name}`);
			assert.equal(flag, "1", `Explicit dependent checked-record Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid dependent checked-record Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate dependent checked-record Rust ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid dependent checked-record Rust MAX_LOAD");
	const maxLoad = rawLoad === undefined ? environment.CI === "true" ? 6 : 12 : Number(rawLoad);
	assert.ok([6, 8, 12, 16].includes(maxLoad), "Dependent checked-record Rust max load must be 6, 8, 12, or 16");
	assert.equal(environment[prefix + "MODES"], undefined
		, "Dependent checked-record Rust modes are encoded by the selected route");
	return { enabled: flag === "1"
		, routes: select("ROUTES", dependentCheckedRecordRustRoutes), maxLoad };
};

/**
 * Select Cargo packaging while retaining ordinary or reviewed author authority.
 *
 * @param route - Exact independent author route.
 */
export const dependentCheckedRecordRustConfiguration = route => {
	assert.ok(dependentCheckedRecordRustRoutes.includes(route), "Unknown dependent checked-record Rust route");
	const selection = dependentCheckedRecordSelection(route);
	return { ...selection.configuration, targets: { cargo: dependentCheckedRecordRustTarget } };
};

/** Load one package-independent caller for the selected public crate. */
export const dependentCheckedRecordRustCaller = () => readFile(
	"tests/fixtures/dependent-checked-record-consumers/rust.rs", "utf8"
);

/**
 * Select Cargo features for ordinary/reviewed constructor diagnostics and the
 * constructor-free API surface.
 *
 * @param route - Exact independent author route.
 */
export const dependentCheckedRecordRustFeatures = route => {
	assert.ok(dependentCheckedRecordRustRoutes.includes(route), "Unknown dependent checked-record Rust route");
	const { resultOnly, reviewed } = dependentCheckedRecordSelection(route);
	return [...resultOnly ? ["result-only"] : [], ...reviewed ? ["reviewed"] : []];
};

/**
 * Require the complete independent Rust caller receipt for one API mode.
 *
 * @param stdout - Complete stdout from the immutable public caller.
 * @param mode - Full API or constructor-free results only.
 */
export const parseDependentCheckedRecordRustResult = (stdout, mode) => {
	assert.ok(dependentCheckedRecordRustModes.includes(mode));
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, dependentCheckedRecordRustCounts[mode]);
	return result;
};

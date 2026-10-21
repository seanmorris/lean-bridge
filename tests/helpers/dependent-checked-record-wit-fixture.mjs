/**
 * Closed WIT/WASI selections and an independent Wasmtime C caller for
 * dependent checked records: the retained `bound` and `below` naturals cross
 * as canonical u32 limb lists inside the `dependent` record, the reviewed Lean
 * constructor refuses every `below >= bound` payload with its exact
 * diagnostic, and 2^130 sized naturals survive both directions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordFixture, dependentCheckedRecordName
	, dependentCheckedRecordRoutes, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordWitRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordWitTarget = Object.freeze({
	name: dependentCheckedRecordName, version: "1.0.0"
});
export const dependentCheckedRecordWitFixtureRoot = dependentCheckedRecordFixture;
export const dependentCheckedRecordWitLeanModule = "DependentRecords";
export const dependentCheckedRecordWitModes = Object.freeze(["full", "result-only"]);
export const dependentCheckedRecordWitLoadCeilings = Object.freeze([8, 12, 16, 20]);
export const dependentCheckedRecordWitCounts = Object.freeze({
	full: Object.freeze({ checks: 4169, rejections: 258, hostRejections: 6
		, recoveries: 264, snapshots: 1301 })
	, "result-only": Object.freeze({ checks: 1549, rejections: 0, hostRejections: 2
		, recoveries: 0, snapshots: 515 })
});

/**
 * Refuse disabled, duplicate, partial, and mode-mismatched selections.
 *
 * @param environment - Explicit host environment.
 */
export const dependentCheckedRecordWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid dependent checked-record WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid dependent checked-record WIT ${name}`);
			assert.equal(flag, "1", `Explicit dependent checked-record WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid dependent checked-record WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate dependent checked-record WIT ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	assert.equal(environment[prefix + "MODES"], undefined
		, "Dependent checked-record WIT modes are encoded by the selected route");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(dependentCheckedRecordWitLoadCeilings.includes(maxLoad)
		, `Dependent checked-record WIT max load must be one of ${dependentCheckedRecordWitLoadCeilings.join(", ")}`);
	return { enabled: flag === "1", routes: select("ROUTES", dependentCheckedRecordWitRoutes), maxLoad };
};

/**
 * Select WIT packaging while retaining ordinary or reviewed authority.
 *
 * @param route - Exact closed author route.
 */
export const dependentCheckedRecordWitConfiguration = route => {
	assert.ok(dependentCheckedRecordWitRoutes.includes(route));
	const selection = dependentCheckedRecordSelection(route);
	return { ...selection.configuration, targets: { "wit-wasi": dependentCheckedRecordWitTarget } };
};

/**
 * Inline independent value helpers into the package-independent C caller.
 *
 * @param route - Exact closed author route.
 */
export const dependentCheckedRecordWitCaller = async route => {
	assert.ok(dependentCheckedRecordWitRoutes.includes(route));
	const root = "tests/fixtures/dependent-checked-record-consumers/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"'; assert.equal(source.split(include).length, 2);
	const header = await readFile(root + "wit-values.h", "utf8");
	source = source.replace(include, () => header);
	const selection = dependentCheckedRecordSelection(route);
	return (selection.resultOnly ? "#define DEPENDENT_RESULT_ONLY\n" : "")
		+ (selection.reviewed ? '#define DEPENDENT_PARAMETER_PREFIX "value"\n' : "")
		+ source;
};

/**
 * Require complete immutable caller totals.
 *
 * @param stdout - Complete caller stdout.
 * @param mode - Full or constructor-free API.
 */
export const parseDependentCheckedRecordWitResult = (stdout, mode) => {
	assert.ok(dependentCheckedRecordWitModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, dependentCheckedRecordWitCounts[mode]);
	return result;
};

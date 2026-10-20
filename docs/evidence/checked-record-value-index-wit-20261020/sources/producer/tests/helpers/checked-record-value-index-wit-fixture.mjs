/**
 * Closed WIT/WASI selections and an independent Wasmtime C caller for
 * proof-erased checked records with compiler-derived value indices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexPackage
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexWitRoutes = checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexWitTarget = Object.freeze({
	name: checkedRecordValueIndexPackage, version: "1.0.0"
});
export const checkedRecordValueIndexWitModes = Object.freeze(["full", "result-only"]);
export const checkedRecordValueIndexWitLoadCeilings = Object.freeze([8, 12, 16, 20]);
export const checkedRecordValueIndexWitCounts = Object.freeze({
	full: Object.freeze({ checks: 90, rejections: 4, hostRejections: 4
		, recoveries: 4, snapshots: 24 })
	, "result-only": Object.freeze({ checks: 26, rejections: 0, hostRejections: 1
		, recoveries: 0, snapshots: 5 })
});

/**
 * Refuse disabled, duplicate, partial, and mode-mismatched selections.
 *
 * @param environment - Explicit host environment.
 */
export const checkedRecordValueIndexWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_VALUE_INDEX_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid value-index WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid value-index WIT ${name}`);
			assert.equal(flag, "1", `Explicit value-index WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid value-index WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate value-index WIT ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	assert.equal(environment[prefix + "MODES"], undefined
		, "Value-index WIT modes are encoded by the selected route");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(checkedRecordValueIndexWitLoadCeilings.includes(maxLoad)
		, `Value-index WIT max load must be one of ${checkedRecordValueIndexWitLoadCeilings.join(", ")}`);
	return { enabled: flag === "1", routes: select("ROUTES", checkedRecordValueIndexWitRoutes), maxLoad };
};

/**
 * Select WIT packaging while retaining ordinary or reviewed authority.
 *
 * @param route - Exact closed author route.
 */
export const checkedRecordValueIndexWitConfiguration = route => {
	assert.ok(checkedRecordValueIndexWitRoutes.includes(route));
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return { ...selection.configuration, targets: { "wit-wasi": checkedRecordValueIndexWitTarget } };
};

/**
 * Inline independent value helpers into the package-independent C caller.
 *
 * @param route - Exact closed author route.
 */
export const checkedRecordValueIndexWitCaller = async route => {
	assert.ok(checkedRecordValueIndexWitRoutes.includes(route));
	const root = "tests/fixtures/checked-record-value-index-wit/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"'; assert.equal(source.split(include).length, 2);
	const header = await readFile(root + "wit-values.h", "utf8");
	source = source.replace(include, () => header);
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return (selection.resultOnly ? "#define VALUE_INDEX_RESULT_ONLY\n" : "")
		+ (selection.reviewed ? '#define VALUE_INDEX_PARAMETER_PREFIX "value"\n' : "")
		+ source;
};

/**
 * Require complete immutable caller totals.
 *
 * @param stdout - Complete caller stdout.
 * @param mode - Full or constructor-free API.
 */
export const parseCheckedRecordValueIndexWitResult = (stdout, mode) => {
	assert.ok(checkedRecordValueIndexWitModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, checkedRecordValueIndexWitCounts[mode]);
	return result;
};

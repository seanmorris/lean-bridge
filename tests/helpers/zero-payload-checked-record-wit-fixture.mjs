/**
 * Closed WIT/WASI selections and an independent Wasmtime C caller for
 * zero-payload checked records: the single-case `empty` enum carrier for the
 * proof-only Witness and plain Marker, the Unit-bearing Token, Option, lists
 * and both Mark variant branches.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes, zeroPayloadBrowserSelection
	, zeroPayloadBrowserName
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadWitRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadWitTarget = Object.freeze({
	name: zeroPayloadBrowserName, version: "1.0.0"
});
export const zeroPayloadWitModes = Object.freeze(["full", "result-only"]);
export const zeroPayloadWitLoadCeilings = Object.freeze([8, 12, 16, 20]);
export const zeroPayloadWitCounts = Object.freeze({
	full: Object.freeze({ checks: 104, rejections: 1, hostRejections: 8
		, recoveries: 9, snapshots: 29 })
	, "result-only": Object.freeze({ checks: 30, rejections: 0, hostRejections: 1
		, recoveries: 0, snapshots: 7 })
});

/**
 * Refuse disabled, duplicate, partial, and mode-mismatched selections.
 *
 * @param environment - Explicit host environment.
 */
export const zeroPayloadWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid zero-payload WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid zero-payload WIT ${name}`);
			assert.equal(flag, "1", `Explicit zero-payload WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid zero-payload WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate zero-payload WIT ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	assert.equal(environment[prefix + "MODES"], undefined
		, "Zero-payload WIT modes are encoded by the selected route");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined ? 8 : Number(rawLoad);
	assert.ok(zeroPayloadWitLoadCeilings.includes(maxLoad)
		, `Zero-payload WIT max load must be one of ${zeroPayloadWitLoadCeilings.join(", ")}`);
	return { enabled: flag === "1", routes: select("ROUTES", zeroPayloadWitRoutes), maxLoad };
};

/**
 * Select WIT packaging while retaining ordinary or reviewed authority.
 *
 * @param route - Exact closed author route.
 */
export const zeroPayloadWitConfiguration = route => {
	assert.ok(zeroPayloadWitRoutes.includes(route));
	const selection = zeroPayloadBrowserSelection(route);
	return { ...selection.configuration, targets: { "wit-wasi": zeroPayloadWitTarget } };
};

/**
 * Inline independent value helpers into the package-independent C caller.
 *
 * @param route - Exact closed author route.
 */
export const zeroPayloadWitCaller = async route => {
	assert.ok(zeroPayloadWitRoutes.includes(route));
	const root = "tests/fixtures/zero-payload-checked-record-wit/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"'; assert.equal(source.split(include).length, 2);
	const header = await readFile(root + "wit-values.h", "utf8");
	source = source.replace(include, () => header);
	const selection = zeroPayloadBrowserSelection(route);
	return (selection.resultOnly ? "#define ZERO_PAYLOAD_RESULT_ONLY\n" : "")
		+ (selection.reviewed ? '#define ZERO_PAYLOAD_PARAMETER_PREFIX "value"\n' : "")
		+ source;
};

/**
 * Require complete immutable caller totals.
 *
 * @param stdout - Complete caller stdout.
 * @param mode - Full or constructor-free API.
 */
export const parseZeroPayloadWitResult = (stdout, mode) => {
	assert.ok(zeroPayloadWitModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, zeroPayloadWitCounts[mode]);
	return result;
};

/**
 * Closed Cargo selections and immutable Rust caller for proof-erased
 * zero-payload checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadRustRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadRustTarget = Object.freeze({
	name: "zeropayloadcheckedrecords", version: "1.0.0"
});
export const zeroPayloadRustModes = Object.freeze(["full", "result-only"]);
export const zeroPayloadRustCounts = Object.freeze({
	full: Object.freeze({
		calls: 16, checks: 28, recoveries: 1, rejections: 1, snapshots: 7
	})
	, "result-only": Object.freeze({
		calls: 9, checks: 14, recoveries: 0, rejections: 0, snapshots: 0
	})
});

/**
 * Reject disabled, duplicate, partial and mode-mismatched selections.
 *
 * @param environment - Explicit host environment.
 */
export const zeroPayloadRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_RUST_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid zero-payload Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string");
			assert.equal(flag, "1"
				, `Explicit zero-payload Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length
			&& selected.every(value => permitted.includes(value)));
		assert.equal(new Set(selected).size, selected.length);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string");
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 12 : Number(rawLoad);
	assert.ok([6, 8, 12, 16].includes(maxLoad)
		, "Zero-payload Rust max load must be 6, 8, 12, or 16");
	assert.equal(environment[prefix + "MODES"], undefined
		, "Zero-payload Rust modes are encoded by the selected route");
	return { enabled: flag === "1"
		, routes: select("ROUTES", zeroPayloadRustRoutes), maxLoad };
};

/**
 * Select Cargo packaging while retaining ordinary or reviewed authority.
 *
 * @param route - Exact source and public-API route.
 */
export const zeroPayloadRustConfiguration = route => {
	assert.ok(zeroPayloadRustRoutes.includes(route));
	const selection = zeroPayloadBrowserSelection(route);
	return {
		...selection.configuration, targets: { cargo: zeroPayloadRustTarget }
	};
};

/** Load the package-independent public caller. */
export const zeroPayloadRustCaller = () => readFile(
	"tests/fixtures/zero-payload-checked-record-rust/rust.rs", "utf8"
);

/**
 * Select Cargo features for result-only and reviewed routes.
 *
 * @param route - Exact source and public-API route.
 */
export const zeroPayloadRustFeatures = route => {
	assert.ok(zeroPayloadRustRoutes.includes(route));
	const { resultOnly, reviewed } = zeroPayloadBrowserSelection(route);
	return [...resultOnly ? ["result-only"] : []
		, ...reviewed ? ["reviewed"] : []];
};

/**
 * Require the complete independent caller receipt.
 *
 * @param stdout - Complete caller stdout.
 * @param mode - Full or result-only API mode.
 */
export const parseZeroPayloadRustResult = (stdout, mode) => {
	assert.ok(zeroPayloadRustModes.includes(mode));
	assert.equal(typeof stdout, "string");
	assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, zeroPayloadRustCounts[mode]);
	return result;
};

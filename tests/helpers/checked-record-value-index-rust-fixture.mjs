/**
 * Closed Rust selections and an immutable caller for proof-erased checked
 * records whose values are fixed by Lean before the crate is compiled.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexPackage
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexRustRoutes = checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexRustTarget = Object.freeze({
	name: checkedRecordValueIndexPackage, version: "1.0.0"
});
export const checkedRecordValueIndexRustModes = Object.freeze(["full", "result-only"]);
export const checkedRecordValueIndexRustCounts = Object.freeze({
	full: Object.freeze({ calls: 24, checks: 41, recoveries: 4, rejections: 4, snapshots: 16 })
	, "result-only": Object.freeze({ calls: 8, checks: 9, recoveries: 0, rejections: 0, snapshots: 0 })
});

/**
 * Reject disabled, duplicate, partial, and mode-mismatched host selections.
 * Result-only is encoded in the author route, never as an independent switch.
 *
 * @param environment - Explicit host environment.
 */
export const checkedRecordValueIndexRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_VALUE_INDEX_RUST_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid value-index Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid value-index Rust ${name}`);
			assert.equal(flag, "1", `Explicit value-index Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid value-index Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate value-index Rust ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid value-index Rust MAX_LOAD");
	const maxLoad = rawLoad === undefined ? environment.CI === "true" ? 6 : 12 : Number(rawLoad);
	assert.ok([6, 8, 12, 16].includes(maxLoad), "Value-index Rust max load must be 6, 8, 12, or 16");
	assert.equal(environment[prefix + "MODES"], undefined
		, "Value-index Rust modes are encoded by the selected route");
	return { enabled: flag === "1"
		, routes: select("ROUTES", checkedRecordValueIndexRustRoutes), maxLoad };
};

/**
 * Select Cargo packaging while retaining ordinary or reviewed author authority.
 *
 * @param route - Exact independent author route.
 */
export const checkedRecordValueIndexRustConfiguration = route => {
	assert.ok(checkedRecordValueIndexRustRoutes.includes(route), "Unknown value-index Rust route");
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return { ...selection.configuration, targets: { cargo: checkedRecordValueIndexRustTarget } };
};

/** Load one package-independent caller for the selected public crate. */
export const checkedRecordValueIndexRustCaller = () => readFile(
	"tests/fixtures/checked-record-value-index-rust/rust.rs", "utf8"
);

/**
 * Select Cargo features for ordinary/reviewed constructor diagnostics and the
 * constructor-free API surface.
 *
 * @param route - Exact independent author route.
 */
export const checkedRecordValueIndexRustFeatures = route => {
	assert.ok(checkedRecordValueIndexRustRoutes.includes(route), "Unknown value-index Rust route");
	const { resultOnly, reviewed } = checkedRecordValueIndexBrowserSelection(route);
	return [...resultOnly ? ["result-only"] : [], ...reviewed ? ["reviewed"] : []];
};

/**
 * Require the complete independent Rust caller receipt for one API mode.
 *
 * @param stdout - Complete stdout from the immutable public caller.
 * @param mode - Full API or constructor-free results only.
 */
export const parseCheckedRecordValueIndexRustResult = (stdout, mode) => {
	assert.ok(checkedRecordValueIndexRustModes.includes(mode));
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, checkedRecordValueIndexRustCounts[mode]);
	return result;
};

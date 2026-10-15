/**
 * Closed Rust selections and independent nineteen-base nominal callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeRustRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeRustModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeRustCounts = Object.freeze({
	full: Object.freeze({ checks: 1332, rejections: 306, snapshotControls: 30, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 601, rejections: 0, snapshotControls: 30, rounds: 256, wordBits: 64 })
});

/**
 * Reject disabled explicit selections, unknown values and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nominalPrimitiveSubtypeRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal Rust ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal Rust ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal Rust ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nominal Rust OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nominalPrimitiveSubtypeRustRoutes), modes: select("MODES", nominalPrimitiveSubtypeRustModes) };
};

/**
 * Keep the complete common author contract and select the native Rust crate.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeRustConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeRustModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { cargo: { name: "nominalprimitivesubtypes", version: "1.0.0" } } };
};

/**
 * Preserve one unchanged caller; select the author route through a Cargo feature.
 *
 * @param route - Explicit ordinary or reviewed source route.
 */
export const nominalPrimitiveSubtypeRustCaller = async route => {
	assert.ok(nominalPrimitiveSubtypeRustRoutes.includes(route));
	return readFile("tests/fixtures/nominal-primitive-subtype-consumers/rust.rs", "utf8");
};

/**
 * Require every check, expected rejection and independent snapshot control.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNominalPrimitiveSubtypeRustResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypeRustModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalPrimitiveSubtypeRustCounts[mode]); return result;
};

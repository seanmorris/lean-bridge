/**
 * Closed Rust selections and an independent public nominal Subtype caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypeRustRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeRustModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypeRustCounts = Object.freeze({
	full: Object.freeze({ checks: 4212, rejections: 1032, snapshotControls: 8 })
	, "result-only": Object.freeze({ checks: 2086, rejections: 0, snapshotControls: 8 })
});

/**
 * Refuse mistyped or duplicate gates instead of silently skipping explicit work.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypeRustSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nominal Rust TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name], selected = raw?.split(",") ?? permitted;
		if(raw !== undefined) assert.equal(flag, "1", `Explicit nominal Rust ${name} requires TEST=1`);
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nominal Rust ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nominal Rust ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nominal Rust OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nominalSubtypeRustRoutes), modes: select("MODES", nominalSubtypeRustModes) };
};

/**
 * Retain the hand-authored contracts and change only the package target.
 *
 * @param route - Ordinary or reviewed author source.
 * @param mode - Full API or constructor-free results.
 */
export const nominalSubtypeRustConfiguration = (route, mode) => {
	assert.ok(nominalSubtypeRustModes.includes(mode));
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only")
		, targets: { cargo: { name: "nominalsubtypes", version: "1.0.0" } } };
};

/**
 * Preserve every assertion while selecting the independently reviewed parameter labels.
 *
 * @param route - Required author route.
 */
export const nominalSubtypeRustCaller = async route => {
	assert.ok(nominalSubtypeRustRoutes.includes(route));
	const source = await readFile("tests/fixtures/nominal-subtype-consumers/rust.rs", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require the complete caller output for the selected API.
 *
 * @param stdout - Original caller output.
 * @param mode - Required API selection.
 */
export const parseNominalSubtypeRustResult = (stdout, mode) => {
	assert.ok(nominalSubtypeRustModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalSubtypeRustCounts[mode]);
	return result;
};

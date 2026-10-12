/**
 * Closed Ruby selections and an independent public nominal Subtype caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypeRubyRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeRubyModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypeRubyCounts = Object.freeze({
	full: Object.freeze({ checks: 4212, rejections: 1032, snapshotControls: 8 })
	, "result-only": Object.freeze({ checks: 2086, rejections: 0, snapshotControls: 8 })
});

/**
 * Refuse mistyped or duplicate gates instead of silently skipping explicit work.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypeRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nominal Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name], selected = raw?.split(",") ?? permitted;
		if(raw !== undefined) assert.equal(flag, "1", `Explicit nominal Ruby ${name} requires TEST=1`);
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nominal Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nominal Ruby ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nominal Ruby OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nominalSubtypeRubyRoutes), modes: select("MODES", nominalSubtypeRubyModes) };
};

/**
 * Retain the hand-authored contracts and change only the package target.
 *
 * @param route - Ordinary or reviewed author source.
 * @param mode - Full API or constructor-free results.
 */
export const nominalSubtypeRubyConfiguration = (route, mode) => {
	assert.ok(nominalSubtypeRubyModes.includes(mode));
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only")
		, targets: { rubygems: { name: "nominalsubtypes", version: "1.0.0" } } };
};

/**
 * Preserve every assertion while selecting the independently reviewed parameter labels.
 *
 * @param route - Required author route.
 */
export const nominalSubtypeRubyCaller = async route => {
	assert.ok(nominalSubtypeRubyRoutes.includes(route));
	const source = await readFile("tests/fixtures/nominal-subtype-consumers/ruby.rb", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require the complete caller output for the selected API.
 *
 * @param stdout - Original caller output.
 * @param mode - Required API selection.
 */
export const parseNominalSubtypeRubyResult = (stdout, mode) => {
	assert.ok(nominalSubtypeRubyModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalSubtypeRubyCounts[mode]);
	return result;
};

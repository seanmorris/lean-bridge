/**
 * Closed Ruby selections and independent nineteen-base nominal callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeRubyRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeRubyModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeRubyCounts = Object.freeze({
	full: Object.freeze({ checks: 1664, rejections: 306, snapshotControls: 12, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 875, rejections: 0, snapshotControls: 12, rounds: 256, wordBits: 64 })
});

/**
 * Reject disabled explicit selections, unknown values and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nominalPrimitiveSubtypeRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal Ruby ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal Ruby ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nominal Ruby OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nominalPrimitiveSubtypeRubyRoutes), modes: select("MODES", nominalPrimitiveSubtypeRubyModes) };
};

/**
 * Keep the complete common author contract and select the native Ruby gem.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeRubyConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeRubyModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { rubygems: { name: "nominalprimitivesubtypes", version: "1.0.0" } } };
};

/**
 * Preserve one unchanged caller; pass the author route explicitly at execution.
 *
 * @param route - Explicit ordinary or reviewed source route.
 */
export const nominalPrimitiveSubtypeRubyCaller = async route => {
	assert.ok(nominalPrimitiveSubtypeRubyRoutes.includes(route));
	return readFile("tests/fixtures/nominal-primitive-subtype-consumers/ruby.rb", "utf8");
};

/**
 * Require every check, expected rejection and independent snapshot control.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNominalPrimitiveSubtypeRubyResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypeRubyModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalPrimitiveSubtypeRubyCounts[mode]); return result;
};

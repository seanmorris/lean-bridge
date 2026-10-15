/**
 * Independent nineteen-base nominal WIT contracts and the complete public Wasmtime C caller.
 * The wire shapes (unit enum, canonical limb lists, signed limb records, u64/s64 platform
 * integers) are the generator's fixed WIT projection; the caller never reads it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeName, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeWitRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeWitModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeWitTarget = Object.freeze({ name: nominalPrimitiveSubtypeName, version: "1.0.0" });
/** Independent caller totals; result-only replays 256 produce rounds instead of pair rejections. */
export const nominalPrimitiveSubtypeWitCounts = Object.freeze({
	full: Object.freeze({ checks: 3114, rejections: 308, hostRejections: 22, snapshotControls: 22, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 5584, rejections: 0, hostRejections: 14, snapshotControls: 22, rounds: 256, wordBits: 64 })
});

/**
 * Refuse misspelled gates and selections instead of silently skipping packages.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const nominalPrimitiveSubtypeWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal WIT ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal WIT ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
	{
		assert.equal(flag, "1", `Explicit ${prefix}OUTPUT requires TEST=1`);
		assert.ok(typeof environment[prefix + "OUTPUT"] === "string" && environment[prefix + "OUTPUT"].length > 0);
	}
	return { enabled: flag === "1", routes: select("ROUTES", nominalPrimitiveSubtypeWitRoutes), modes: select("MODES", nominalPrimitiveSubtypeWitModes) };
};

/**
 * Keep every nineteen-base nominal identity and directional refinement decision.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeWitReview = mode => {
	assert.ok(nominalPrimitiveSubtypeWitModes.includes(mode)); return nominalPrimitiveSubtypeReview(mode === "result-only");
};

/**
 * Select WIT packaging without deriving ordinary decisions from compiler output.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeWitConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeWitRoutes.includes(route)); assert.ok(nominalPrimitiveSubtypeWitModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { "wit-wasi": { ...nominalPrimitiveSubtypeWitTarget } } };
};

/**
 * Inline the independent value and input helpers so consumers need no repository files.
 *
 * @param route - Ordinary or independently reviewed diagnostic names.
 * @param mode - Explicit API selection.
 */
export const nominalPrimitiveSubtypeWitCaller = async (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeWitRoutes.includes(route)); assert.ok(nominalPrimitiveSubtypeWitModes.includes(mode));
	const root = "tests/fixtures/nominal-primitive-subtype-consumers/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	for(const name of ["wit-values.h", "wit-inputs.h"])
	{
		const include = `#include "${name}"`; assert.equal(source.split(include).length, 2);
		const header = await readFile(root + name, "utf8"); source = source.replace(include, () => header);
	}
	if(mode === "result-only") source = "#define NOMINAL_RESULT_ONLY\n" + source;
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Refuse incomplete observations, missing refusals or altered caller counts.
 *
 * @param stdout - Complete original caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNominalPrimitiveSubtypeWitResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypeWitModes.includes(mode)); const result = JSON.parse(stdout);
	assert.deepEqual(result, nominalPrimitiveSubtypeWitCounts[mode]); return result;
};

/**
 * Closed C/C++ selections and independent primitive-base nominal callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeNativeProfiles = Object.freeze(["c", "cpp"]);
export const nominalPrimitiveSubtypeNativeRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeNativeModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeNativeCounts = Object.freeze({
	c: Object.freeze({
		full: Object.freeze({ checks: 3714, rejections: 306, rounds: 256, snapshotControls: 22, wordBits: 64 })
		, "result-only": Object.freeze({ checks: 583, rejections: 0, rounds: 256, snapshotControls: 22, wordBits: 64 })
	})
	, cpp: Object.freeze({
		full: Object.freeze({ checks: 1314, rejections: 306, rounds: 256, snapshotControls: 9, wordBits: 64 })
		, "result-only": Object.freeze({ checks: 579, rejections: 0, rounds: 256, snapshotControls: 9, wordBits: 64 })
	})
});

/**
 * An enabled gate always builds and executes both public native projections.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nominalPrimitiveSubtypeNativeSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base native TEST");
	assert.equal(environment[prefix + "PROFILES"], undefined, "Both C and C++ profiles are required");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base native ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base native ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base native ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base native ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit native OUTPUT requires TEST=1");
	return { enabled: flag === "1", profiles: nominalPrimitiveSubtypeNativeProfiles
		, routes: select("ROUTES", nominalPrimitiveSubtypeNativeRoutes)
		, modes: select("MODES", nominalPrimitiveSubtypeNativeModes) };
};

/**
 * Retain the complete common contract and select both C and C++ archives.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeNativeConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeNativeModes.includes(mode));
	return nominalPrimitiveSubtypeConfiguration(route, nominalPrimitiveSubtypeNativeProfiles, mode === "result-only");
};

/**
 * Reuse identical caller assertions; select only mode and diagnostic parameter names.
 *
 * @param profile - Public C or C++ surface.
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or standalone constructor-free results.
 */
export const nominalPrimitiveSubtypeNativeCaller = async (profile, route, mode) => {
	assert.ok(nominalPrimitiveSubtypeNativeProfiles.includes(profile));
	assert.ok(nominalPrimitiveSubtypeNativeRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypeNativeModes.includes(mode));
	const source = await readFile(`tests/fixtures/nominal-primitive-subtype-consumers/${profile}.${profile}`, "utf8");
	return (mode === "result-only" ? "#define PRIMITIVE_RESULT_ONLY\n" : "")
		+ (route === "reviewed" ? '#define PRIMITIVE_PARAMETER_PREFIX "value"\n' : "") + source;
};

/**
 * Require the full independently specified check, refusal and snapshot totals.
 *
 * @param stdout - Original unmodified caller output.
 * @param profile - Public C or C++ surface.
 * @param mode - Explicit API mode.
 */
export const parseNominalPrimitiveSubtypeNativeResult = (stdout, profile, mode) => {
	assert.ok(nominalPrimitiveSubtypeNativeProfiles.includes(profile));
	assert.ok(nominalPrimitiveSubtypeNativeModes.includes(mode));
	const value = JSON.parse(stdout); assert.deepEqual(value, nominalPrimitiveSubtypeNativeCounts[profile][mode]); return value;
};

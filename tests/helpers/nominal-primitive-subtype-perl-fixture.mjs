/**
 * Explicit CPAN selections and independent primitive-base nominal Subtype caller counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkedRecordPerlExecutables } from "./checked-record-perl-install.mjs";
import { nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypePerlModule = "LeanBridge::NominalPrimitiveSubtypes";
export const nominalPrimitiveSubtypePerlRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypePerlModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypePerlCounts = Object.freeze({
	full: Object.freeze({ checks: 1225, rejections: 283, snapshotControls: 9, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 587, rejections: 0, snapshotControls: 9, rounds: 256, wordBits: 64 })
});

/**
 * Refuse misspelled gates and selections instead of silently skipping packages.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const nominalPrimitiveSubtypePerlSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal Perl TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal Perl ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal Perl ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal Perl ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal Perl ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return { enabled: flag === "1", routes: select("ROUTES", nominalPrimitiveSubtypePerlRoutes), modes: select("MODES", nominalPrimitiveSubtypePerlModes) };
};

/**
 * All four pinned ABIs are required; an override relocates executables without narrowing the matrix.
 *
 * @param override - Optional JSON object mapping every configuration to an absolute executable.
 */
export const nominalPrimitiveSubtypePerlExecutables = override => checkedRecordPerlExecutables(override);

/**
 * Change only the downstream target of the independently authored configuration.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or standalone constructor-free result API.
 */
export const nominalPrimitiveSubtypePerlConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePerlModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { cpan: { module: nominalPrimitiveSubtypePerlModule, version: "1.000" } } };
};

/**
 * Load the unchanged caller; the runner passes the explicit author route as an argument.
 *
 * @param route - Explicit author route.
 */
export const nominalPrimitiveSubtypePerlCaller = async route => {
	assert.ok(nominalPrimitiveSubtypePerlRoutes.includes(route));
	return readFile("tests/fixtures/nominal-primitive-subtype-consumers/perl.pl", "utf8");
};

/**
 * Select the API mode and reviewed parameter labels without changing the caller bytes.
 *
 * @param route - Ordinary or reviewed author route.
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePerlArguments = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePerlRoutes.includes(route)); assert.ok(nominalPrimitiveSubtypePerlModes.includes(mode));
	return ["consumer.pl", ...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []];
};

/**
 * Require every check and expected rejection for the selected API.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package API.
 */
export const parseNominalPrimitiveSubtypePerlResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypePerlModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalPrimitiveSubtypePerlCounts[mode]);
	return result;
};

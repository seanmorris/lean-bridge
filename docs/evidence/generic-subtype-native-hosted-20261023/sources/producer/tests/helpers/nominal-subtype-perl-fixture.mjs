/**
 * Explicit CPAN selections and independent nominal Subtype caller counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypePerlModule = "LeanBridge::NominalSubtypes";
export const nominalSubtypePerlRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypePerlModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypePerlCounts = Object.freeze({
	full: Object.freeze({ checks: 4212, rejections: 1032, snapshotControls: 8 })
	, "result-only": Object.freeze({ checks: 2086, rejections: 0, snapshotControls: 8 })
});

/**
 * Refuse misspelled gates and selections instead of silently skipping packages.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const nominalSubtypePerlSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nominal Perl TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name], selected = raw?.split(",") ?? permitted;
		if(raw !== undefined) assert.equal(flag, "1", `Explicit nominal Perl ${name} requires TEST=1`);
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nominal Perl ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nominal Perl ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nominal Perl OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nominalSubtypePerlRoutes), modes: select("MODES", nominalSubtypePerlModes) };
};

/**
 * Change only the downstream target of the independently authored configuration.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or standalone constructor-free result API.
 */
export const nominalSubtypePerlConfiguration = (route, mode) => {
	assert.ok(nominalSubtypePerlModes.includes(mode));
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only")
		, targets: { cpan: { module: nominalSubtypePerlModule, version: "1.000" } } };
};

/**
 * Retain every assertion and change only reviewed parameter labels.
 *
 * @param route - Explicit author route.
 */
export const nominalSubtypePerlCaller = async route => {
	assert.ok(nominalSubtypePerlRoutes.includes(route));
	const source = await readFile("tests/fixtures/nominal-subtype-consumers/perl.pl", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require the complete selected caller, not a partial success marker.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package API.
 */
export const parseNominalSubtypePerlResult = (stdout, mode) => {
	assert.ok(nominalSubtypePerlModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalSubtypePerlCounts[mode]);
	return result;
};

/**
 * Independent Perl author selections and public caller for structural Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

export const structuralSubtypePerlModule = "LeanBridge::StructuralSubtypes";
export const structuralSubtypePerlCounts = Object.freeze({ checks: 4119, rejections: 1042, snapshotControls: 6 });
export const structuralSubtypePerlRoutes = Object.freeze(["ordinary", "reviewed"]);

/**
 * Retain the hand-authored contracts while selecting CPAN.
 *
 * @param route - Ordinary source or independent review.
 */
export const structuralSubtypePerlConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { cpan: { module: structuralSubtypePerlModule, version: "1.000" } }
});

/**
 * Change only the independently reviewed parameter labels.
 *
 * @param route - Explicit author route.
 */
export const structuralSubtypePerlCaller = async route => {
	assert.ok(structuralSubtypePerlRoutes.includes(route));
	const source = await readFile("tests/fixtures/structural-subtype-consumers/perl.pl", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require the complete public corpus, not a partial success marker.
 *
 * @param stdout - Original complete caller output.
 */
export const parseStructuralSubtypePerlResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypePerlCounts);
	return result;
};

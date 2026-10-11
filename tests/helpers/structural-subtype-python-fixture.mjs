/**
 * Independent Python author configuration and public caller for structural Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

export const structuralSubtypePythonCounts = Object.freeze({ checks: 4119, rejections: 1042, snapshotControls: 6 });

/**
 * Keep the common independent contracts while selecting an actual PyPI target.
 *
 * @param route - Ordinary source or independently reviewed source.
 */
export const structuralSubtypePythonConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { pypi: { name: "structuralsubtypes", version: "1.0.0" } }
});

/**
 * Preserve caller bytes except the independent review's parameter names.
 *
 * @param route - Explicit author route.
 */
export const structuralSubtypePythonCaller = async route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const source = await readFile("tests/fixtures/structural-subtype-consumers/python.py", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Reject partial or unexpected public results, including lost negative controls.
 *
 * @param stdout - Original complete caller output.
 */
export const parseStructuralSubtypePythonResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypePythonCounts);
	return result;
};

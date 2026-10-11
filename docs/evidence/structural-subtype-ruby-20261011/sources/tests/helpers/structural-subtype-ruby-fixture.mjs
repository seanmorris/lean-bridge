/**
 * Independent Ruby author configuration and public caller for structural Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

export const structuralSubtypeRubyCounts = Object.freeze({ checks: 4119, rejections: 1042, snapshotControls: 6 });

/**
 * Keep the common independent contracts while selecting an actual RubyGems target.
 *
 * @param route - Ordinary source or independently reviewed source.
 */
export const structuralSubtypeRubyConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { rubygems: { name: "structuralsubtypes", version: "1.0.0" } }
});

/**
 * Preserve caller bytes except the independent review's parameter names.
 *
 * @param route - Explicit author route.
 */
export const structuralSubtypeRubyCaller = async route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const source = await readFile("tests/fixtures/structural-subtype-consumers/ruby.rb", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Reject partial or unexpected public results, including lost negative controls.
 *
 * @param stdout - Original complete caller output.
 */
export const parseStructuralSubtypeRubyResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypeRubyCounts);
	return result;
};

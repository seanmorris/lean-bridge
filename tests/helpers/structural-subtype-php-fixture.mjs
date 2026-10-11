/**
 * Independent native PHP author configuration and strict/weak public caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

export const structuralSubtypePhpCounts = Object.freeze({ checks: 4119, rejections: 1042, snapshotControls: 6 });

/**
 * Select a Composer package without changing the independently reviewed contracts.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const structuralSubtypePhpConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { "php-native": { name: "example/structuralsubtypes", version: "1.0.0" } }
});

/**
 * Adapt diagnostic parameter labels only, preserving all caller assertions.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const structuralSubtypePhpCaller = async route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const source = await readFile("tests/fixtures/structural-subtype-consumers/php-native.php", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require complete original caller results.
 *
 * @param stdout - Original complete public caller output.
 */
export const parseStructuralSubtypePhpResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypePhpCounts);
	return result;
};

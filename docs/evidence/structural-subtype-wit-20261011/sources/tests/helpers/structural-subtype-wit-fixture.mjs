/**
 * Independent WIT structural Subtype author choices and complete public C caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

// 28 one-argument successes, 1,001 two-argument successes; 42/1,000 refusals.
// Each call checks complete output/error and every input. Six setup/lifetime checks.
export const structuralSubtypeWitCounts = Object.freeze({ checks: 28 * 3 + 1001 * 4 + 42 * 4 + 1000 * 5 + 6, rejections: 1042, snapshotControls: 12 });

/**
 * Preserve ordinary/reviewed constructor contracts while selecting WIT packaging.
 *
 * @param route - Explicit author route.
 */
export const structuralSubtypeWitConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { "wit-wasi": { name: "structuralsubtypes", version: "1.0.0" } }
});

/**
 * Inline value helpers so the downstream caller needs no repository files.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const structuralSubtypeWitCaller = async route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const prefix = "tests/fixtures/structural-subtype-consumers/";
	const header = await readFile(prefix + "wit-values.h", "utf8"), raw = await readFile(prefix + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"\n'; assert.equal(raw.split(include).length, 2);
	const source = raw.replace(include, header + "\n");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Refuse incomplete observations or lost rejection/snapshot controls.
 *
 * @param stdout - Original complete output.
 */
export const parseStructuralSubtypeWitResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypeWitCounts);
	return result;
};

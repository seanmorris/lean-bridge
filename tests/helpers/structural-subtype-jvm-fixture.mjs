/**
 * Independent Jvm public caller and ordinary/reviewed Maven author configurations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

export const structuralSubtypeJvmCounts = Object.freeze({ checks: 4119, rejections: 1042, snapshotControls: 6 });

/**
 * Select Maven without changing the independently authored refinement choices.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const structuralSubtypeJvmConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { maven: { name: "org.leanbridge:structuralsubtypes", version: "1.0.0" } }
});

/**
 * Keep one caller, changing only the independent review's parameter labels.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Explicit author route.
 */
export const structuralSubtypeJvmCaller = async (profile, route) => {
	assert.ok(["java", "kotlin"].includes(profile));
	assert.ok(["ordinary", "reviewed"].includes(route));
	const source = await readFile(`tests/fixtures/structural-subtype-consumers/${profile}.${profile === "java" ? "java" : "kt"}`, "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Reject incomplete output and unexpected counter values.
 *
 * @param stdout - Original complete public caller output.
 */
export const parseStructuralSubtypeJvmResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypeJvmCounts);
	return result;
};

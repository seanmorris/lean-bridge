/**
 * Independent Dotnet public caller and ordinary/reviewed NuGet author configurations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";

export const structuralSubtypeDotnetCounts = Object.freeze({ checks: 4119, rejections: 1042, snapshotControls: 6 });

/**
 * Select NuGet without changing the independently authored refinement choices.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const structuralSubtypeDotnetConfiguration = route => ({
	...structuralSubtypeConfiguration(route, ["c"])
	, targets: { nuget: { name: "StructuralSubtypes.Api", version: "1.0.0" } }
});

/**
 * Keep one caller, changing only the independent review's parameter labels.
 *
 * @param route - Explicit author route.
 */
export const structuralSubtypeDotnetCaller = async route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const source = await readFile("tests/fixtures/structural-subtype-consumers/dotnet.cs", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Reject incomplete output and unexpected counter values.
 *
 * @param stdout - Original complete public caller output.
 */
export const parseStructuralSubtypeDotnetResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, structuralSubtypeDotnetCounts);
	return result;
};

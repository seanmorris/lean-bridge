/**
 * Closed C# selections and an independent public nominal Subtype caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypeDotnetRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeDotnetModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypeDotnetCounts = Object.freeze({
	full: Object.freeze({ checks: 4226, rejections: 1032, hostRejections: 7, snapshotControls: 8 })
	, "result-only": Object.freeze({ checks: 2088, rejections: 0, hostRejections: 1, snapshotControls: 8 })
});

/**
 * Refuse mistyped or duplicate gates instead of silently skipping explicit work.
 *
 * @param environment - Explicit producer environment.
 */
export const nominalSubtypeDotnetSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_DOTNET_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nominal C# TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name], selected = raw?.split(",") ?? permitted;
		if(raw !== undefined) assert.equal(flag, "1", `Explicit nominal C# ${name} requires TEST=1`);
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nominal C# ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nominal C# ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", "Explicit nominal C# OUTPUT requires TEST=1");
	return { enabled: flag === "1", routes: select("ROUTES", nominalSubtypeDotnetRoutes), modes: select("MODES", nominalSubtypeDotnetModes) };
};

/**
 * Retain the hand-authored contracts and change only the package target.
 *
 * @param route - Ordinary or reviewed author source.
 * @param mode - Full API or constructor-free results.
 */
export const nominalSubtypeDotnetConfiguration = (route, mode) => {
	assert.ok(nominalSubtypeDotnetModes.includes(mode));
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only")
		, targets: { nuget: { name: "Nominalsubtypes.Api", version: "1.0.0" } } };
};

/**
 * Select independently reviewed labels without changing the caller's assertions.
 *
 * @param route - Required author route.
 * @param mode - Required API selection.
 */
export const nominalSubtypeDotnetCaller = async (route, mode) => {
	assert.ok(nominalSubtypeDotnetRoutes.includes(route)); assert.ok(nominalSubtypeDotnetModes.includes(mode));
	let source = await readFile("tests/fixtures/nominal-subtype-consumers/dotnet.cs", "utf8");
	if(route === "reviewed") source = source.replaceAll(/arg([01])/gu, "value$1");
	return (mode === "result-only" ? "#define RESULT_ONLY\n" : "") + source;
};

/**
 * Require every independent assertion count for the selected API.
 *
 * @param stdout - Original caller output.
 * @param mode - Required API selection.
 */
export const parseNominalSubtypeDotnetResult = (stdout, mode) => {
	assert.ok(nominalSubtypeDotnetModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalSubtypeDotnetCounts[mode]);
	return result;
};

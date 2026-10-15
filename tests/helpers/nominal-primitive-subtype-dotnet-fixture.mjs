/**
 * Closed C# selections and an independent nineteen-base nominal caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypeDotnetRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypeDotnetModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypeDotnetCounts = Object.freeze({
	full: Object.freeze({ checks: 1346, rejections: 306, hostRejections: 7, snapshotControls: 30, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 603, rejections: 0, hostRejections: 1, snapshotControls: 30, rounds: 256, wordBits: 64 })
});

/**
 * Reject disabled explicit selections, unknown values and duplicated runs.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nominalPrimitiveSubtypeDotnetSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal C# TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal C# ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal C# ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal C# ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal C# ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1", "Explicit primitive-base nominal C# OUTPUT requires TEST=1");
	return { enabled: flag === "1"
		, routes: select("ROUTES", nominalPrimitiveSubtypeDotnetRoutes)
		, modes: select("MODES", nominalPrimitiveSubtypeDotnetModes) };
};

/**
 * Keep the complete common author contract and select the native NuGet package.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeDotnetConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeDotnetModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { nuget: { name: "Nominalprimitivesubtypes.Api", version: "1.0.0" } } };
};

/**
 * Preserve one caller while selecting result-only and reviewed diagnostics at compile time.
 *
 * @param route - Explicit ordinary or reviewed source route.
 * @param mode - Full or result-only public API.
 */
export const nominalPrimitiveSubtypeDotnetCaller = async (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeDotnetRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypeDotnetModes.includes(mode));
	const defines = [mode === "result-only" ? "#define RESULT_ONLY" : ""
		, route === "reviewed" ? "#define REVIEWED" : ""].filter(Boolean).join("\n");
	const source = await readFile("tests/fixtures/nominal-primitive-subtype-consumers/dotnet.cs", "utf8");
	return (defines ? defines + "\n" : "") + source;
};

/**
 * Require every check, expected rejection and independent snapshot control.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNominalPrimitiveSubtypeDotnetResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypeDotnetModes.includes(mode));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, nominalPrimitiveSubtypeDotnetCounts[mode]);
	return result;
};

/**
 * Closed C# selections and an independent nested checked-record caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	nestedCheckedRecordConfiguration
	, nestedCheckedRecordReview
} from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordDotnetRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordDotnetModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordDotnetCounts = Object.freeze({
	full: Object.freeze({
		checks: 3924, rejections: 524, hostRejections: 7
		, recoveries: 528, snapshots: 1054, rounds: 256, wordBits: 64
	})
	, "result-only": Object.freeze({
		checks: 1290, rejections: 0, hostRejections: 4
		, recoveries: 1, snapshots: 1, rounds: 256, wordBits: 64
	})
});

/**
 * Reject disabled explicit selections, unknown values and duplicate work.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nestedCheckedRecordDotnetSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid nested checked-record C# TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid nested checked-record C# ${name}`);
			assert.equal(flag, "1"
				, `Explicit nested checked-record C# ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid nested checked-record C# ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate nested checked-record C# ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1"
			, "Explicit nested checked-record C# OUTPUT requires TEST=1");
	const configuredMaxLoad = environment[prefix + "MAX_LOAD"];
	if(configuredMaxLoad !== undefined)
		assert.equal(flag, "1"
			, "Explicit nested checked-record C# MAX_LOAD requires TEST=1");
	const maxLoad = configuredMaxLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(configuredMaxLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Nested checked-record C# max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", nestedCheckedRecordDotnetRoutes)
		, modes: select("MODES", nestedCheckedRecordDotnetModes), maxLoad
	};
};

/**
 * Select one ordinary or reviewed full/result-only NuGet package.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const nestedCheckedRecordDotnetConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordDotnetRoutes.includes(route));
	assert.ok(nestedCheckedRecordDotnetModes.includes(mode));
	return {
		...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: {
			nuget: { name: "Nestedcheckedrecords.Api", version: "1.0.0" }
		}
	};
};

/**
 * Add only route/mode selectors to the immutable checked-in C# caller.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const nestedCheckedRecordDotnetCaller = async (route, mode) => {
	assert.ok(nestedCheckedRecordDotnetRoutes.includes(route));
	assert.ok(nestedCheckedRecordDotnetModes.includes(mode));
	const source = await readFile(
		"tests/fixtures/nested-checked-record-consumers/dotnet.cs", "utf8"
	);
	const defines = [
		mode === "result-only" ? "#define RESULT_ONLY" : ""
		, route === "reviewed" ? "#define REVIEWED" : ""
	].filter(Boolean).join("\n");
	return (defines ? defines + "\n" : "") + source;
};

/**
 * Require every independent check, rejection, recovery and snapshot total.
 *
 * @param stdout - Original complete public caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNestedCheckedRecordDotnetResult = (stdout, mode) => {
	assert.ok(nestedCheckedRecordDotnetModes.includes(mode));
	const value = JSON.parse(stdout);
	assert.deepEqual(value, nestedCheckedRecordDotnetCounts[mode]);
	return value;
};

/** Exact independently authored reviewed IR for the selected API mode. */
export const nestedCheckedRecordDotnetReview = nestedCheckedRecordReview;

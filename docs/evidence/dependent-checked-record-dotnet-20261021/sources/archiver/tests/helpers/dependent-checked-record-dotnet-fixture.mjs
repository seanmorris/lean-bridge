/**
 * Exact NuGet selections and independent C# caller for dependent checked
 * records: a retained `bound : Nat` with a retained `below : Fin bound`,
 * checked only by the reviewed Lean constructor and projected to a sealed C#
 * record with two BigInteger fields.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordFixture, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordDotnetRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordDotnetTarget = Object.freeze({
	name: "Dependentrecords.Api", version: "1.0.0"
});
export const dependentCheckedRecordDotnetFixtureRoot = dependentCheckedRecordFixture;
export const dependentCheckedRecordDotnetLeanModule = "DependentRecords";
export const dependentCheckedRecordDotnetCounts = Object.freeze({
	full: Object.freeze({ calls: 1289, checks: 2326, recoveries: 258
		, rejections: 258, snapshots: 1289 })
	, "result-only": Object.freeze({
		calls: 513, checks: 516, recoveries: 0, rejections: 0, snapshots: 513
	})
});

/**
 * Replace only npm coordinates with one independently consumed NuGet package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordDotnetSelection = route => {
	const selected = dependentCheckedRecordSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: { nuget: dependentCheckedRecordDotnetTarget }
		}
	};
};

/**
 * Reject disabled explicit selections, spelling mistakes and duplicate routes.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const dependentCheckedRecordDotnetEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid dependent checked-record .NET TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined)
	{
		assert.equal(flag, "1", "Explicit dependent checked-record .NET routes require TEST=1");
		assert.equal(typeof raw, "string");
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const routes = raw === undefined
		? [...dependentCheckedRecordDotnetRoutes] : raw.split(",");
	assert.ok(routes.length
		&& routes.every(route => dependentCheckedRecordDotnetRoutes.includes(route))
		&& new Set(routes).size === routes.length
	, "Invalid dependent checked-record .NET routes");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Dependent checked-record .NET max load must be 6, 8, 10, or 12");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Add only compile-time route selectors to the immutable checked-in caller.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const dependentCheckedRecordDotnetCaller = async (
	route, reader = path => readFile(path)
) => {
	const selection = dependentCheckedRecordDotnetSelection(route);
	const source = (await reader(
		"tests/fixtures/dependent-checked-record-consumers/dotnet.cs"
	)).toString();
	const defines = [
		selection.resultOnly ? "#define RESULT_ONLY" : ""
		, selection.reviewed ? "#define REVIEWED" : ""
	].filter(Boolean).join("\n");
	return (defines ? defines + "\n" : "") + source;
};

/**
 * Require the exact compact receipt emitted by the independent C# caller.
 *
 * @param source - One JSON line.
 * @param route - Exact author/API route.
 */
export const parseDependentCheckedRecordDotnetResult = (source, route) => {
	assert.equal(typeof source, "string");
	const selection = dependentCheckedRecordDotnetSelection(route);
	const expected = dependentCheckedRecordDotnetCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections", "snapshots"]);
	assert.deepEqual(value, expected);
	return value;
};

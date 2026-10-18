/**
 * Exact NuGet selections and independent C# caller for checked-record value indices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexDotnetRoutes
	= checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexDotnetTarget = Object.freeze({
	name: "Checkedrecordvalueindices.Api", version: "1.0.0"
});
export const checkedRecordValueIndexDotnetCounts = Object.freeze({
	full: Object.freeze({ calls: 30, checks: 31, recoveries: 7, rejections: 7 })
	, "result-only": Object.freeze({
		calls: 8, checks: 9, recoveries: 0, rejections: 0
	})
});

/**
 * Replace only npm coordinates with one independently consumed NuGet package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexDotnetSelection = route => {
	const selected = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: { nuget: checkedRecordValueIndexDotnetTarget }
		}
	};
};

/**
 * Reject disabled explicit selections, spelling mistakes and duplicated routes.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const checkedRecordValueIndexDotnetEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_VALUE_INDEX_DOTNET_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid value-index .NET TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined)
	{
		assert.equal(flag, "1", "Explicit value-index .NET routes require TEST=1");
		assert.equal(typeof raw, "string");
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const routes = raw === undefined
		? [...checkedRecordValueIndexDotnetRoutes] : raw.split(",");
	assert.ok(routes.length
		&& routes.every(route => checkedRecordValueIndexDotnetRoutes.includes(route))
		&& new Set(routes).size === routes.length
	, "Invalid value-index .NET routes");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Value-index .NET max load must be 6, 8, 10, or 12");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Add only compile-time route selectors to the immutable checked-in caller.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const checkedRecordValueIndexDotnetCaller = async (
	route, reader = path => readFile(path)
) => {
	const selection = checkedRecordValueIndexDotnetSelection(route);
	const source = (await reader(
		"tests/fixtures/checked-record-value-index-dotnet/dotnet.cs"
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
export const parseCheckedRecordValueIndexDotnetResult = (source, route) => {
	assert.equal(typeof source, "string");
	const selection = checkedRecordValueIndexDotnetSelection(route);
	const expected = checkedRecordValueIndexDotnetCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections"]);
	assert.deepEqual(value, expected);
	return value;
};

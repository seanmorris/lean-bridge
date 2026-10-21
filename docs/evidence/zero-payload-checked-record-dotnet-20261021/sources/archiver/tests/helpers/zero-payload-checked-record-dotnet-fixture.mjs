/**
 * Exact NuGet selections and independent C# caller for zero-payload records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadDotnetRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadDotnetTarget = Object.freeze({
	name: "Zeropayloadcheckedrecords.Api", version: "1.0.0"
});
export const zeroPayloadDotnetCounts = Object.freeze({
	full: Object.freeze({ calls: 21, checks: 22, recoveries: 4, rejections: 4 })
	, "result-only": Object.freeze({
		calls: 8, checks: 9, recoveries: 0, rejections: 0
	})
});

/**
 * Replace only npm coordinates with one independently consumed NuGet package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadDotnetSelection = route => {
	const selected = zeroPayloadBrowserSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: { nuget: zeroPayloadDotnetTarget }
		}
	};
};

/**
 * Reject disabled explicit selections, spelling mistakes and duplicate routes.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const zeroPayloadDotnetEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid zero-payload .NET TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined)
	{
		assert.equal(flag, "1", "Explicit zero-payload .NET routes require TEST=1");
		assert.equal(typeof raw, "string");
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const routes = raw === undefined
		? [...zeroPayloadDotnetRoutes] : raw.split(",");
	assert.ok(routes.length
		&& routes.every(route => zeroPayloadDotnetRoutes.includes(route))
		&& new Set(routes).size === routes.length
	, "Invalid zero-payload .NET routes");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Zero-payload .NET max load must be 6, 8, 10, or 12");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Add only compile-time route selectors to the immutable checked-in caller.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const zeroPayloadDotnetCaller = async (
	route, reader = path => readFile(path)
) => {
	const selection = zeroPayloadDotnetSelection(route);
	const source = (await reader(
		"tests/fixtures/zero-payload-checked-record-dotnet/dotnet.cs"
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
export const parseZeroPayloadDotnetResult = (source, route) => {
	assert.equal(typeof source, "string");
	const selection = zeroPayloadDotnetSelection(route);
	const expected = zeroPayloadDotnetCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections"]);
	assert.deepEqual(value, expected);
	return value;
};

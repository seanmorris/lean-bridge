/**
 * Static NuGet selection, projection and immutable-caller controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import {
	checkedRecordValueIndexDotnetCaller, checkedRecordValueIndexDotnetCounts
	, checkedRecordValueIndexDotnetEnvironment, checkedRecordValueIndexDotnetRoutes
	, checkedRecordValueIndexDotnetSelection, checkedRecordValueIndexDotnetTarget
	, parseCheckedRecordValueIndexDotnetResult
} from "./checked-record-value-index-dotnet-fixture.mjs";

test("value-index .NET selection is closed and explicit", () => {
	assert.deepEqual(checkedRecordValueIndexDotnetEnvironment({}), {
		enabled: false, routes: [...checkedRecordValueIndexDotnetRoutes], maxLoad: 10
	});
	assert.deepEqual(checkedRecordValueIndexDotnetEnvironment({ CI: "true" }), {
		enabled: false, routes: [...checkedRecordValueIndexDotnetRoutes], maxLoad: 6
	});
	assert.deepEqual(checkedRecordValueIndexDotnetEnvironment({
		LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_DOTNET_ROUTES: "result-only-reviewed-ir"
		, LEAN_BRIDGE_VALUE_INDEX_DOTNET_MAX_LOAD: "12"
	}), { enabled: true, routes: ["result-only-reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST: "yes" }
		, { LEAN_BRIDGE_VALUE_INDEX_DOTNET_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_DOTNET_ROUTES: "unknown" }
		, { LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_DOTNET_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_DOTNET_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_DOTNET_MAX_LOAD: "14" }
	]) assert.throws(() => checkedRecordValueIndexDotnetEnvironment(environment));
});

test("value-index .NET configuration retains four independent routes", () => {
	for(const route of checkedRecordValueIndexDotnetRoutes)
	{
		const selection = checkedRecordValueIndexDotnetSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			nuget: checkedRecordValueIndexDotnetTarget
		});
		assert.deepEqual(selection.configuration.modules
			, ["CheckedRecordValueIndices"]);
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 8 : 16);
		assert.equal(Object.hasOwn(selection.configuration, "contracts")
			, !selection.reviewed);
		assert.equal(selection.expected.declarations.length
			, selection.resultOnly ? 8 : 16);
		assert.equal(selection.expected.types.length, 8);
	}
});

test("value-index C# projection keeps payloads while erasing every index proof", () => {
	const full = checkedRecordValueIndexDotnetSelection("reviewed-ir");
	const files = generateCopiedDotnetPackage(full.expected);
	const api = files["src/LeanBridge.Checkedrecordvalueindices/Api.cs"];
	for(const signature of [
		"record On(global::System.Numerics.BigInteger Count)"
		, "record Off(global::System.Numerics.BigInteger Count)"
		, "record Ab(global::System.Numerics.BigInteger Size)"
		, "record EmptyToken(global::System.Numerics.BigInteger Count)"
		, "record UnicodeToken(global::System.Numerics.BigInteger Count)"
		, "record EmptySized(global::System.Numerics.BigInteger[] Data)"
		, "record ZeroToken(global::System.Numerics.BigInteger Count)"
		, "record WideToken(global::System.Numerics.BigInteger Count)"
	]) assert.ok(api.includes(signature), signature);
	for(const method of [
		"TrueBoolIndex", "FalseBoolIndex", "AbStringIndex", "EmptyStringIndex"
		, "UnicodeStringIndex", "EmptySizedIndex", "ZeroNatIndex", "WideNatIndex"
		, "ProduceTrueBool", "ProduceFalseBool", "ProduceAb"
		, "ProduceEmptyString", "ProduceUnicodeString", "ProduceEmptySized"
		, "ProduceZeroNat", "ProduceWideNat"
	]) assert.match(api, new RegExp(`\\b${method}\\(`, "u"));
	assert.doesNotMatch(api, /\b(?:Set|Named|Fixed)\s*\{/u);
	assert.doesNotMatch(api, /(?:bool|string)\s+(?:Set|Named|Fixed)\b/u);

	const result = checkedRecordValueIndexDotnetSelection(
		"result-only-reviewed-ir");
	const resultApi = generateCopiedDotnetPackage(result.expected)[
		"src/LeanBridge.Checkedrecordvalueindices/Api.cs"
	];
	for(const method of [
		"TrueBoolIndex", "FalseBoolIndex", "AbStringIndex", "EmptyStringIndex"
		, "UnicodeStringIndex", "EmptySizedIndex", "ZeroNatIndex", "WideNatIndex"
	]) assert.doesNotMatch(resultApi, new RegExp(`\\b${method}\\(`, "u"));
	for(const method of ["ProduceTrueBool", "ProduceFalseBool", "ProduceAb"
		, "ProduceEmptyString", "ProduceUnicodeString", "ProduceEmptySized"
		, "ProduceZeroNat", "ProduceWideNat"])
		assert.match(resultApi, new RegExp(`\\b${method}\\(`, "u"));
});

test("value-index C# caller is immutable and independently counted", async () => {
	const source = await readFile(
		"tests/fixtures/checked-record-value-index-dotnet/dotnet.cs", "utf8"
	);
	assert.match(source, /BigInteger\.One << 128/u);
	assert.match(source, /zero\.GetType\(\) != wide\.GetType\(\)/u);
	assert.match(source, /ArgumentOutOfRangeException/u);
	assert.match(source, /StringComparison\.Ordinal/u);
	assert.match(source, /arguments\[0\] == "--runtime"/u);
	assert.match(source, /RuntimeInformation\.FrameworkDescription/u);
	assert.match(source, /#if !RESULT_ONLY[\s\S]*?#endif/u);
	for(const route of checkedRecordValueIndexDotnetRoutes)
	{
		const selection = checkedRecordValueIndexDotnetSelection(route);
		const caller = await checkedRecordValueIndexDotnetCaller(route);
		assert.ok(caller.endsWith(source));
		assert.equal(caller.includes("#define REVIEWED"), selection.reviewed);
		assert.equal(caller.includes("#define RESULT_ONLY"), selection.resultOnly);
		const mode = selection.resultOnly ? "result-only" : "full";
		const expected = checkedRecordValueIndexDotnetCounts[mode];
		assert.deepEqual(parseCheckedRecordValueIndexDotnetResult(
			JSON.stringify(expected), route), expected);
		for(const field of Object.keys(expected))
		{
			const changed = { ...expected, [field]: expected[field] + 1 };
			assert.throws(() => parseCheckedRecordValueIndexDotnetResult(
				JSON.stringify(changed), route));
		}
	}
});

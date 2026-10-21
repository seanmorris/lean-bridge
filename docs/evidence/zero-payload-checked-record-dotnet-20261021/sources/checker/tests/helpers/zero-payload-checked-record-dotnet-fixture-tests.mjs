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
	parseZeroPayloadDotnetResult, zeroPayloadDotnetCaller
	, zeroPayloadDotnetCounts, zeroPayloadDotnetEnvironment
	, zeroPayloadDotnetRoutes, zeroPayloadDotnetSelection
	, zeroPayloadDotnetTarget
} from "./zero-payload-checked-record-dotnet-fixture.mjs";

test("zero-payload .NET selection is closed and explicit", () => {
	assert.deepEqual(zeroPayloadDotnetEnvironment({}), {
		enabled: false, routes: [...zeroPayloadDotnetRoutes], maxLoad: 10
	});
	assert.deepEqual(zeroPayloadDotnetEnvironment({ CI: "true" }), {
		enabled: false, routes: [...zeroPayloadDotnetRoutes], maxLoad: 6
	});
	assert.deepEqual(zeroPayloadDotnetEnvironment({
		LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_ROUTES: "result-only-reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_MAX_LOAD: "12"
	}), { enabled: true, routes: ["result-only-reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_TEST: "yes" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_ROUTES: "unknown" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_DOTNET_MAX_LOAD: "14" }
	]) assert.throws(() => zeroPayloadDotnetEnvironment(environment));
});

test("zero-payload .NET configuration retains four independent routes", () => {
	for(const route of zeroPayloadDotnetRoutes)
	{
		const selection = zeroPayloadDotnetSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			nuget: zeroPayloadDotnetTarget
		});
		assert.deepEqual(selection.configuration.modules
			, ["ZeroPayloadCheckedRecords"]);
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 6 : 11);
		assert.equal(Object.hasOwn(selection.configuration, "contracts")
			, !selection.reviewed);
		assert.equal(selection.expected.declarations.length
			, selection.resultOnly ? 6 : 11);
		assert.deepEqual(selection.expected.types.map(type => type.name)
			, ["Witness", "Token", "Marker", "Mark"]);
	}
});

test("zero-payload C# carriers preserve empty, Unit, Option and array identity", () => {
	const full = zeroPayloadDotnetSelection("reviewed-ir");
	const files = generateCopiedDotnetPackage(full.expected);
	const api = files["src/LeanBridge.Zeropayloadcheckedrecords/Api.cs"];
	assert.match(api, /public sealed record Witness\(\)/u);
	assert.match(api, /public sealed record Token\(Unit Tag\)/u);
	assert.match(api, /public sealed record Marker\(\)/u);
	assert.match(api, /public sealed record MarkBlank\(\) : Mark/u);
	assert.match(api, /public sealed record MarkMarked\(Witness Witness\) : Mark/u);
	assert.match(api, /Equals\(Witness\? other\) => other is not null/u);
	assert.match(api, /Witness\[\] Witnesses\(/u);
	assert.match(api, /Option<Witness> MaybeWitness\(/u);
	assert.doesNotMatch(api, /\b(?:Positive|Fresh)\b/u);
	for(const method of [
		"WitnessCount", "AbsentCount", "TokenTag", "MarkerCount", "MarkCount"
		, "ProduceWitness", "ProduceToken", "Witnesses", "MaybeWitness"
		, "ProduceMarker", "ProduceMark"
	]) assert.match(api, new RegExp(`\\b${method}\\(`, "u"));

	const result = zeroPayloadDotnetSelection("result-only-reviewed-ir");
	const resultApi = generateCopiedDotnetPackage(result.expected)[
		"src/LeanBridge.Zeropayloadcheckedrecords/Api.cs"
	];
	for(const method of ["WitnessCount", "AbsentCount", "TokenTag", "MarkerCount", "MarkCount"])
		assert.doesNotMatch(resultApi, new RegExp(`\\b${method}\\(`, "u"));
	for(const method of [
		"ProduceWitness", "ProduceToken", "Witnesses", "MaybeWitness"
		, "ProduceMarker", "ProduceMark"
	]) assert.match(resultApi, new RegExp(`\\b${method}\\(`, "u"));
});

test("zero-payload C# caller is immutable and independently counted", async () => {
	const source = await readFile(
		"tests/fixtures/zero-payload-checked-record-dotnet/dotnet.cs", "utf8"
	);
	assert.match(source, /new Witness\(\)/u);
	assert.match(source, /new Token\(default\)/u);
	assert.match(source, /new Marker\(\)/u);
	assert.match(source, /new MarkBlank\(\)/u);
	assert.match(source, /new MarkMarked\(new Witness\(\)\)/u);
	assert.match(source, /new MarkMarked\(null!\)/u);
	assert.match(source, /Api\.WitnessCount\(null!\)/u);
	assert.match(source, /ArgumentNullException/u);
	assert.match(source, /GetType\(\) != witness\.GetType\(\)/u);
	assert.match(source, /arguments\[0\] == "--runtime"/u);
	for(const counter of ["calls", "checks", "recoveries", "rejections"])
		assert.match(source, new RegExp(`static int ${counter} = 0;`, "u"));
	for(const route of zeroPayloadDotnetRoutes)
	{
		const selection = zeroPayloadDotnetSelection(route);
		const caller = await zeroPayloadDotnetCaller(route);
		assert.ok(caller.endsWith(source));
		assert.equal(caller.includes("#define REVIEWED"), selection.reviewed);
		assert.equal(caller.includes("#define RESULT_ONLY"), selection.resultOnly);
		const mode = selection.resultOnly ? "result-only" : "full";
		const expected = zeroPayloadDotnetCounts[mode];
		assert.deepEqual(parseZeroPayloadDotnetResult(
			JSON.stringify(expected), route), expected);
		for(const field of Object.keys(expected))
		{
			const changed = { ...expected, [field]: expected[field] + 1 };
			assert.throws(() => parseZeroPayloadDotnetResult(
				JSON.stringify(changed), route));
		}
	}
});

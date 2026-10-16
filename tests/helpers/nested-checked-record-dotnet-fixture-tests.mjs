/**
 * Static C# selection, projection and immutable-caller controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import {
	nestedCheckedRecordDotnetCaller
	, nestedCheckedRecordDotnetConfiguration
	, nestedCheckedRecordDotnetCounts
	, nestedCheckedRecordDotnetModes
	, nestedCheckedRecordDotnetRoutes
	, nestedCheckedRecordDotnetReview
	, nestedCheckedRecordDotnetSelection
	, parseNestedCheckedRecordDotnetResult
} from "./nested-checked-record-dotnet-fixture.mjs";

test("nested checked-record C# selection is closed and explicit", () => {
	assert.deepEqual(nestedCheckedRecordDotnetSelection({}), {
		enabled: false, routes: [...nestedCheckedRecordDotnetRoutes]
		, modes: [...nestedCheckedRecordDotnetModes], maxLoad: 10
	});
	assert.deepEqual(nestedCheckedRecordDotnetSelection({
		LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_TEST: "1"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_ROUTES: "reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_MODES: "result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_MAX_LOAD: "12"
	}), {
		enabled: true, routes: ["reviewed"], modes: ["result-only"], maxLoad: 12
	});
	for(const environment of [
		{ LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_TEST: "yes" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_MODES: "unknown"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_TEST: "1" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_ROUTES: "ordinary,ordinary"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_TEST: "1" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_MAX_LOAD: "14"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_DOTNET_TEST: "1" }
	]) assert.throws(() => nestedCheckedRecordDotnetSelection(environment));
});

test("nested checked-record C# configuration retains both author routes and API modes", () => {
	for(const route of nestedCheckedRecordDotnetRoutes)
		for(const mode of nestedCheckedRecordDotnetModes)
		{
			const configuration = nestedCheckedRecordDotnetConfiguration(route, mode);
			assert.deepEqual(configuration.targets, {
				nuget: { name: "Nestedcheckedrecords.Api", version: "1.0.0" }
			});
			assert.deepEqual(configuration.modules, ["NestedCheckedRecords"]);
			assert.equal(Object.hasOwn(configuration, "contracts"), route === "ordinary");
			assert.equal(nestedCheckedRecordDotnetReview(mode).declarations.length
				, mode === "full" ? 13 : 2);
		}
});

test("nested checked-record C# projection is proof-free and retains every copied carrier", () => {
	const files = generateCopiedDotnetPackage(nestedCheckedRecordDotnetReview("full"));
	const api = files["src/LeanBridge.Nestedcheckedrecords/Api.cs"];
	assert.match(api, /record Packet\(global::System\.Numerics\.BigInteger Digit, global::System\.Numerics\.BigInteger Word\)/u);
	assert.doesNotMatch(api, /Linked|linked/u);
	assert.match(api, /record Holder\(Packet Packet, global::System\.Numerics\.BigInteger Tag\)/u);
	assert.match(api, /record ChoicePacket\(Packet Value\) : Choice/u);
	for(const signature of [
		"Packet[] EchoArray(Packet[] @value0)"
		, "BigInteger InArray(Packet[] @value0)"
		, "BigInteger InList(Packet[] @value0)"
		, "BigInteger InOption(Option<Packet> @value0)"
		, "BigInteger InProduct((Packet, Packet) @value0)"
		, "BigInteger InExcept(Result<Packet, Packet> @value0)"
		, "BigInteger InHolder(Holder @value0)"
		, "BigInteger InChoice(Choice @value0)"
		, "Option<Packet> ProduceOption"
		, "Packet[] ProduceArray"
	]) assert.ok(api.includes(signature), signature);
	assert.match(files["README.md"], /Checked records cross as generated record values containing only their payload fields/u);
	assert.match(files["README.md"], /Fin and Subtype payload fields run their checks before the outer record constructor/u);
});

test("nested checked-record C# caller is one immutable source with fixed totals", async () => {
	const source = await readFile(
		"tests/fixtures/nested-checked-record-consumers/dotnet.cs", "utf8"
	);
	assert.match(source, /#if !RESULT_ONLY\n\x20{4}static string Snap\(Holder[\s\S]*?static string Snap\(Choice[\s\S]*?#endif/u);
	for(const route of nestedCheckedRecordDotnetRoutes)
		for(const mode of nestedCheckedRecordDotnetModes)
		{
			const caller = await nestedCheckedRecordDotnetCaller(route, mode);
			assert.ok(caller.endsWith(source));
			assert.equal(caller.includes("#define REVIEWED"), route === "reviewed");
			assert.equal(caller.includes("#define RESULT_ONLY"), mode === "result-only");
			const expected = nestedCheckedRecordDotnetCounts[mode];
			assert.deepEqual(parseNestedCheckedRecordDotnetResult(
				JSON.stringify(expected), mode), expected);
			for(const field of Object.keys(expected))
			{
				const changed = { ...expected, [field]: expected[field] + 1 };
				assert.throws(() => parseNestedCheckedRecordDotnetResult(
					JSON.stringify(changed), mode));
			}
		}
});

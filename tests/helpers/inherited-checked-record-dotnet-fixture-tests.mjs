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
	inheritedCheckedRecordDotnetCaller
	, inheritedCheckedRecordDotnetConfiguration
	, inheritedCheckedRecordDotnetCounts
	, inheritedCheckedRecordDotnetModes
	, inheritedCheckedRecordDotnetRoutes
	, inheritedCheckedRecordDotnetReview
	, inheritedCheckedRecordDotnetSelection
	, inheritedCheckedRecordDotnetTarget
	, parseInheritedCheckedRecordDotnetResult
} from "./inherited-checked-record-dotnet-fixture.mjs";

test("inherited checked-record C# selection is closed and explicit", () => {
	assert.deepEqual(inheritedCheckedRecordDotnetSelection({}), {
		enabled: false, routes: [...inheritedCheckedRecordDotnetRoutes]
		, modes: [...inheritedCheckedRecordDotnetModes], maxLoad: 10
	});
	assert.deepEqual(inheritedCheckedRecordDotnetSelection({ CI: "true" }), {
		enabled: false, routes: [...inheritedCheckedRecordDotnetRoutes]
		, modes: [...inheritedCheckedRecordDotnetModes], maxLoad: 6
	});
	assert.deepEqual(inheritedCheckedRecordDotnetSelection({
		LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_TEST: "1"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_ROUTES: "reviewed"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_MODES: "result-only"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_MAX_LOAD: "12"
	}), {
		enabled: true, routes: ["reviewed"], modes: ["result-only"], maxLoad: 12
	});
	for(const environment of [
		{ LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_TEST: "yes" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_MODES: "unknown"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_TEST: "1" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_ROUTES: "ordinary,ordinary"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_TEST: "1" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_MAX_LOAD: "14"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_DOTNET_TEST: "1" }
	]) assert.throws(() => inheritedCheckedRecordDotnetSelection(environment));
});

test("inherited checked-record C# configuration retains both routes and API modes", () => {
	for(const route of inheritedCheckedRecordDotnetRoutes)
		for(const mode of inheritedCheckedRecordDotnetModes)
		{
			const configuration = inheritedCheckedRecordDotnetConfiguration(route, mode);
			assert.deepEqual(configuration.targets, {
				nuget: inheritedCheckedRecordDotnetTarget
			});
			assert.deepEqual(configuration.modules, ["InheritedCheckedRecords"]);
			assert.equal(Object.hasOwn(configuration, "contracts")
				, route === "ordinary" && mode === "full");
			assert.equal(configuration.exports?.length
				, route === "ordinary" ? mode === "full" ? 8 : 2 : undefined);
			const review = inheritedCheckedRecordDotnetReview(mode);
			assert.equal(review.declarations.length, mode === "full" ? 8 : 2);
			assert.deepEqual(review.types.map(type => type.name)
				, mode === "full"
					? ["Span", "Stamped", "Ticket", "TicketAlias"]
					: ["Span", "Stamped", "Ticket"]);
		}
});

test("inherited checked-record C# projection keeps all payloads and erases proofs", () => {
	const files = generateCopiedDotnetPackage(
		inheritedCheckedRecordDotnetReview("full")
	);
	const api = files["src/LeanBridge.Inheritedcheckedrecords/Api.cs"];
	assert.match(api, /record Span\(global::System\.Numerics\.BigInteger Lo, global::System\.Numerics\.BigInteger Hi\)/u);
	assert.match(api, /record Ticket\(Span ToSpan, global::System\.Numerics\.BigInteger Word\)/u);
	assert.match(api, /record Stamped\(Ticket ToTicket, global::System\.Numerics\.BigInteger Mark\)/u);
	assert.doesNotMatch(api, /\b(?:Ordered|Linked)\b/u);
	assert.doesNotMatch(api, /(?:BigInteger|bool) Stamped\b/u);
	assert.match(api, /TicketAlias<\/c><\/term><description><c>Ticket<\/c> projects to <c>Ticket<\/c>/u);
	for(const signature of [
		"BigInteger First(Ticket @value0)"
		, "BigInteger Normalized(Ticket @value0)"
		, "BigInteger Pair(Ticket @value0, Ticket @value1)"
		, "BigInteger Aliased(Ticket @value0)"
		, "BigInteger Nested(Stamped @value0)"
		, "Ticket Echo(Ticket @value0)"
		, "Ticket Produce(global::System.Numerics.BigInteger @value0)"
		, "Stamped ProduceStamped(global::System.Numerics.BigInteger @value0)"
	]) assert.ok(api.includes(signature), signature);

	const resultOnly = generateCopiedDotnetPackage(
		inheritedCheckedRecordDotnetReview("result-only")
	)["src/LeanBridge.Inheritedcheckedrecords/Api.cs"];
	assert.doesNotMatch(resultOnly, /\b(?:First|Normalized|Pair|Aliased|Nested|Echo)\(/u);
	assert.match(resultOnly, /\bProduce\(/u);
	assert.match(resultOnly, /\bProduceStamped\(/u);
});

test("inherited checked-record C# caller is immutable and independently counted", async () => {
	const source = await readFile(
		"tests/fixtures/inherited-checked-record-consumers/dotnet.cs", "utf8"
	);
	assert.match(source, /Generated record equality is deliberately not used as an oracle/u);
	assert.doesNotMatch(source, /==\s*new\s+(?:Span|Ticket|Stamped)\b/u);
	assert.match(source, /#if !RESULT_ONLY[\s\S]*?static void Full\(\)[\s\S]*?#endif/u);
	for(const route of inheritedCheckedRecordDotnetRoutes)
		for(const mode of inheritedCheckedRecordDotnetModes)
		{
			const caller = await inheritedCheckedRecordDotnetCaller(route, mode);
			assert.ok(caller.endsWith(source));
			assert.equal(caller.includes("#define REVIEWED"), route === "reviewed");
			assert.equal(caller.includes("#define RESULT_ONLY")
				, mode === "result-only");
			const expected = inheritedCheckedRecordDotnetCounts[mode];
			assert.deepEqual(parseInheritedCheckedRecordDotnetResult(
				JSON.stringify(expected), mode), expected);
			for(const field of Object.keys(expected))
			{
				const changed = { ...expected, [field]: expected[field] + 1 };
				assert.throws(() => parseInheritedCheckedRecordDotnetResult(
					JSON.stringify(changed), mode));
			}
		}
});

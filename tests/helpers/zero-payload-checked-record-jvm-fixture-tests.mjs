/**
 * Freeze Maven selection, generated carriers and independent JVM callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	generateCopiedJvmKotlinPackage
} from "../../src/backends/jvm/copied-kotlin.mjs";
import {
	parseZeroPayloadJvmResult, zeroPayloadJvmCaller, zeroPayloadJvmCounts
	, zeroPayloadJvmEnvironment, zeroPayloadJvmProfiles, zeroPayloadJvmRoutes
	, zeroPayloadJvmSelection, zeroPayloadJvmTarget
} from "./zero-payload-checked-record-jvm-fixture.mjs";

const inputs = [
	"witnessCount", "absentCount", "tokenTag", "markerCount", "markCount"
];
const results = [
	"produceWitness", "produceToken", "witnesses", "maybeWitness"
	, "produceMarker", "produceMark"
];

test("zero-payload JVM selection is closed and explicit", () => {
	assert.deepEqual(zeroPayloadJvmProfiles, ["java", "kotlin"]);
	assert.deepEqual(zeroPayloadJvmEnvironment({}), {
		enabled: false, routes: [...zeroPayloadJvmRoutes], maxLoad: 10
	});
	assert.deepEqual(zeroPayloadJvmEnvironment({ CI: "true" }), {
		enabled: false, routes: [...zeroPayloadJvmRoutes], maxLoad: 6
	});
	assert.deepEqual(zeroPayloadJvmEnvironment({
		LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_JVM_ROUTES: "result-only-reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_JVM_MAX_LOAD: "12"
	}), { enabled: true, routes: ["result-only-reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST: "yes" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_JVM_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_JVM_ROUTES: "unknown" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_JVM_ROUTES: "reviewed-ir,reviewed-ir" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_JVM_MAX_LOAD: "14" }
	]) assert.throws(() => zeroPayloadJvmEnvironment(environment));
});

test("zero-payload JVM configuration retains four independent routes", () => {
	for(const route of zeroPayloadJvmRoutes)
	{
		const selection = zeroPayloadJvmSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			maven: zeroPayloadJvmTarget
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

test("zero-payload JVM carriers keep empty, Unit, Option and variant identity", () => {
	for(const route of ["reviewed-ir", "result-only-reviewed-ir"])
	{
		const selection = zeroPayloadJvmSelection(route);
		const files = generateCopiedJvmKotlinPackage(selection.expected);
		const java = "src/main/java/org/leanbridge/zeropayloadcheckedrecords/";
		const kotlin
			= "src/main/kotlin/org/leanbridge/zeropayloadcheckedrecords/kotlin/";
		assert.match(files[java + "Witness.java"], /record Witness\(\)/u);
		assert.match(files[java + "Token.java"], /record Token\(Unit tag\)/u);
		assert.match(files[java + "Marker.java"], /record Marker\(\)/u);
		assert.match(files[java + "MarkBlank.java"], /record MarkBlank\(\)/u);
		assert.match(files[java + "MarkMarked.java"]
			, /record MarkMarked\(Witness witness\)/u);
		assert.match(files[java + "Option.java"]
			, /record Some<T>\(T value\) implements Option<T>/u);
		assert.match(files[kotlin + "Witness.kt"], /class `Witness`\(\)/u);
		assert.match(files[kotlin + "Token.kt"], /val `tag`:/u);
		assert.match(files[kotlin + "Marker.kt"], /class `Marker`\(\)/u);
		assert.match(files[kotlin + "MarkBlank.kt"], /class `MarkBlank`\(\)/u);
		assert.match(files[kotlin + "MarkMarked.kt"], /val `witness`:/u);
		for(const [prefix, extension] of [[java, "java"], [kotlin, "kt"]])
		{
			const api = files[prefix + `Api.${extension}`];
			for(const name of inputs) assert.equal(
				new RegExp(`\\b${name}\\b`, "u").test(api)
				, !selection.resultOnly, `${route}/${extension}/${name}`);
			for(const name of results)
				assert.match(api, new RegExp(`\\b${name}\\b`, "u"));
		}
	}
});

test("zero-payload JVM callers preserve exact route and receipt counts", async () => {
	for(const profile of zeroPayloadJvmProfiles)
		for(const route of zeroPayloadJvmRoutes)
		{
			const selection = zeroPayloadJvmSelection(route);
			const source = await zeroPayloadJvmCaller(profile, route);
			assert.doesNotMatch(source, /ROUTE_PREFIX|FULL_ONLY/u);
			assert.ok(source.includes(selection.reviewed ? "value0" : "arg0"));
			for(const name of inputs) assert.equal(
				new RegExp(`Api\\.${name}\\b`, "u").test(source)
				, !selection.resultOnly, `${profile}/${route}/${name}`);
			for(const name of results)
				assert.match(source, new RegExp(`Api\\.${name}\\b`, "u"));
			assert.equal(/null(?:Api)?Refused/u.test(source)
				, !selection.resultOnly);
			assert.equal(/MarkMarked\([^)]*null/u.test(source)
				|| /newInstance\(null\)/u.test(source), !selection.resultOnly);
			const expected = zeroPayloadJvmCounts[
				selection.resultOnly ? "result-only" : "full"
			];
			assert.deepEqual(parseZeroPayloadJvmResult(
				JSON.stringify(expected), route), expected);
			for(const field of Object.keys(expected))
				assert.throws(() => parseZeroPayloadJvmResult(
					JSON.stringify({ ...expected, [field]: expected[field] + 1 })
					, route));
		}
});

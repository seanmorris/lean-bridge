/**
 * Freeze Maven selection, generated API shape and independent caller coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	generateCopiedJvmKotlinPackage
} from "../../src/backends/jvm/copied-kotlin.mjs";
import {
	checkedRecordValueIndexJvmCaller
	, checkedRecordValueIndexJvmCounts
	, checkedRecordValueIndexJvmEnvironment
	, checkedRecordValueIndexJvmProfiles
	, checkedRecordValueIndexJvmRoutes
	, checkedRecordValueIndexJvmSelection
	, checkedRecordValueIndexJvmTarget
	, parseCheckedRecordValueIndexJvmResult
} from "./checked-record-value-index-jvm-fixture.mjs";

const inputs = [
	"trueBoolIndex", "falseBoolIndex", "abStringIndex", "emptyStringIndex"
	, "unicodeStringIndex", "emptySizedIndex", "zeroNatIndex", "wideNatIndex"
];
const results = [
	"produceTrueBool", "produceFalseBool", "produceAb", "produceEmptyString"
	, "produceUnicodeString", "produceEmptySized", "produceZeroNat"
	, "produceWideNat"
];

test("value-index JVM selection is closed and explicit", () => {
	assert.deepEqual(checkedRecordValueIndexJvmProfiles, ["java", "kotlin"]);
	assert.deepEqual(checkedRecordValueIndexJvmEnvironment({}), {
		enabled: false, routes: [...checkedRecordValueIndexJvmRoutes], maxLoad: 10
	});
	assert.deepEqual(checkedRecordValueIndexJvmEnvironment({ CI: "true" }), {
		enabled: false, routes: [...checkedRecordValueIndexJvmRoutes], maxLoad: 6
	});
	assert.deepEqual(checkedRecordValueIndexJvmEnvironment({
		LEAN_BRIDGE_VALUE_INDEX_JVM_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_JVM_ROUTES: "result-only-reviewed-ir"
		, LEAN_BRIDGE_VALUE_INDEX_JVM_MAX_LOAD: "12"
	}), { enabled: true, routes: ["result-only-reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_VALUE_INDEX_JVM_TEST: "yes" }
		, { LEAN_BRIDGE_VALUE_INDEX_JVM_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_JVM_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_JVM_ROUTES: "unknown" }
		, { LEAN_BRIDGE_VALUE_INDEX_JVM_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_JVM_ROUTES: "reviewed-ir,reviewed-ir" }
		, { LEAN_BRIDGE_VALUE_INDEX_JVM_TEST: "1"
			, LEAN_BRIDGE_VALUE_INDEX_JVM_MAX_LOAD: "14" }
	]) assert.throws(() => checkedRecordValueIndexJvmEnvironment(environment));
});

test("value-index JVM configuration retains four independent routes", () => {
	for(const route of checkedRecordValueIndexJvmRoutes)
	{
		const selection = checkedRecordValueIndexJvmSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			maven: checkedRecordValueIndexJvmTarget
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

test("value-index JVM projections keep payloads and erase every index proof", () => {
	for(const route of ["reviewed-ir", "result-only-reviewed-ir"])
	{
		const selection = checkedRecordValueIndexJvmSelection(route);
		const files = generateCopiedJvmKotlinPackage(selection.expected);
		for(const [prefix, extension] of [
			["src/main/java/org/leanbridge/checkedrecordvalueindices/", "java"]
			, ["src/main/kotlin/org/leanbridge/checkedrecordvalueindices/kotlin/", "kt"]
		]) {
			const api = files[prefix + `Api.${extension}`];
			assert.ok(api);
			for(const name of inputs) assert.equal(new RegExp(`\\b${name}\\b`, "u")
				.test(api), !selection.resultOnly, `${route}/${extension}/${name}`);
			for(const name of results)
				assert.match(api, new RegExp(`\\b${name}\\b`, "u"));
			for(const name of [
				"On", "Off", "Ab", "EmptySized", "ZeroToken", "WideToken"
				, "EmptyToken", "UnicodeToken"
			]) {
				const source = files[prefix + `${name}.${extension}`];
				assert.ok(source, `${prefix}${name}`);
				assert.doesNotMatch(source, /\b(?:set|named|sized|fixed)\b/u);
			}
		}
	}
});

test("value-index JVM callers cover both hosts and preserve exact counts", async () => {
	for(const profile of checkedRecordValueIndexJvmProfiles)
		for(const route of checkedRecordValueIndexJvmRoutes)
		{
			const selection = checkedRecordValueIndexJvmSelection(route);
			const source = await checkedRecordValueIndexJvmCaller(profile, route);
			assert.doesNotMatch(source, /ROUTE_PREFIX|FULL_ONLY/u);
			assert.ok(source.includes(selection.reviewed ? "value0" : "arg0"));
			for(const name of inputs) assert.equal(new RegExp(`Api\\.${name}\\b`, "u")
				.test(source), !selection.resultOnly, `${profile}/${route}/${name}`);
			for(const name of results)
				assert.match(source, new RegExp(`Api\\.${name}\\b`, "u"));
			assert.equal(/Nat cannot be negative/u.test(source), !selection.resultOnly);
			assert.equal(/nullRefused/u.test(source), !selection.resultOnly);
			const expected = checkedRecordValueIndexJvmCounts[
				selection.resultOnly ? "result-only" : "full"
			];
			assert.deepEqual(parseCheckedRecordValueIndexJvmResult(
				JSON.stringify(expected), route), expected);
			for(const field of Object.keys(expected))
				assert.throws(() => parseCheckedRecordValueIndexJvmResult(
					JSON.stringify({ ...expected, [field]: expected[field] + 1 })
					, route));
		}
});

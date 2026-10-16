/**
 * Freeze the nested checked-record Maven selections and independent caller surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCopiedJvmKotlinPackage } from "../../src/backends/jvm/copied-kotlin.mjs";
import {
	nestedCheckedRecordJvmCaller
	, nestedCheckedRecordJvmConfiguration
	, nestedCheckedRecordJvmCounts
	, nestedCheckedRecordJvmModes
	, nestedCheckedRecordJvmProfiles
	, nestedCheckedRecordJvmReview
	, nestedCheckedRecordJvmRoutes
	, nestedCheckedRecordJvmSelection
} from "./nested-checked-record-jvm-fixture.mjs";
import {
	nestedCheckedRecordJvmInputNames
	, nestedCheckedRecordJvmProbeSource
	, nestedCheckedRecordKotlinNullSource
} from "./nested-checked-record-jvm-probe.mjs";

test("nested checked-record JVM selection is closed and explicit", () => {
	assert.deepEqual(nestedCheckedRecordJvmRoutes, ["ordinary", "reviewed"]);
	assert.deepEqual(nestedCheckedRecordJvmModes, ["full", "result-only"]);
	assert.deepEqual(nestedCheckedRecordJvmProfiles, ["java", "kotlin"]);
	assert.deepEqual(nestedCheckedRecordJvmSelection({}), {
		enabled: false, routes: [...nestedCheckedRecordJvmRoutes]
		, modes: [...nestedCheckedRecordJvmModes], maxLoad: 10
	});
	assert.deepEqual(nestedCheckedRecordJvmSelection({ CI: "true" }), {
		enabled: false, routes: [...nestedCheckedRecordJvmRoutes]
		, modes: [...nestedCheckedRecordJvmModes], maxLoad: 6
	});
	assert.deepEqual(nestedCheckedRecordJvmSelection({
		LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "1"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_ROUTES: "reviewed"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MODES: "result-only"
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MAX_LOAD: "12"
	}), {
		enabled: true, routes: ["reviewed"], modes: ["result-only"], maxLoad: 12
	});
	for(const environment of [
		{ LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "yes" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_ROUTES: "ordinary,ordinary" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MODES: "unknown" }
		, { LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MAX_LOAD: "14" }
	]) assert.throws(() => nestedCheckedRecordJvmSelection(environment));
});

test("nested checked-record JVM configuration retains both author routes and API modes", () => {
	for(const route of nestedCheckedRecordJvmRoutes)
		for(const mode of nestedCheckedRecordJvmModes)
		{
			const configuration = nestedCheckedRecordJvmConfiguration(route, mode);
			assert.deepEqual(configuration.targets, {
				maven: { name: "org.leanbridge:nestedcheckedrecords", version: "1.0.0" }
			});
			assert.deepEqual(configuration.modules, ["NestedCheckedRecords"]);
			assert.equal(Object.hasOwn(configuration.targets, "c"), false);
			if(route === "ordinary")
			{
				assert.equal(configuration.exports.length, mode === "full" ? 13 : 2);
				assert.equal(Object.keys(configuration.contracts).length
					, configuration.exports.length);
			}
			else
			{
				assert.equal(configuration.exports, undefined);
				assert.equal(configuration.contracts, undefined);
			}
			assert.equal(nestedCheckedRecordJvmReview(mode).declarations.length
				, mode === "full" ? 13 : 2);
		}
});

test("nested checked-record JVM projection is proof-free and retains copied carriers", () => {
	for(const mode of nestedCheckedRecordJvmModes)
	{
		const files = generateCopiedJvmKotlinPackage(
			nestedCheckedRecordJvmReview(mode)
		);
		for(const prefix of [
			"src/main/java/org/leanbridge/nestedcheckedrecords/"
			, "src/main/kotlin/org/leanbridge/nestedcheckedrecords/kotlin/"
		]) {
			const api = files[prefix + (prefix.includes("kotlin") ? "Api.kt" : "Api.java")];
			assert.ok(api);
			assert.match(api, /produceOption/u);
			assert.match(api, /produceArray/u);
			assert.equal(/\bfirst\b/u.test(api), mode === "full");
			const packet = files[prefix + (prefix.includes("kotlin")
				? "Packet.kt" : "Packet.java")];
			assert.ok(packet);
			assert.doesNotMatch(packet, /linked|proof/iu);
			assert.equal(Boolean(files[prefix + (prefix.includes("kotlin")
				? "Holder.kt" : "Holder.java")]), mode === "full");
		}
	}
});

test("nested checked-record JVM callers select only route labels and API sections", async () => {
	for(const profile of nestedCheckedRecordJvmProfiles)
		for(const route of nestedCheckedRecordJvmRoutes)
			for(const mode of nestedCheckedRecordJvmModes)
			{
				const source = await nestedCheckedRecordJvmCaller(profile, route, mode);
				assert.ok(source.includes(`PREFIX = "${route === "ordinary" ? "arg" : "value"}"`));
				assert.doesNotMatch(source, /ROUTE_PREFIX|FULL_ONLY/u);
				assert.equal(source.includes("Api.first"), mode === "full");
				assert.ok(source.includes("Api.produceOption"));
				assert.ok(source.includes("Api.produceArray"));
			}
	assert.deepEqual(nestedCheckedRecordJvmCounts.java
		, nestedCheckedRecordJvmCounts.kotlin);
});

test("nested checked-record JVM compile probes distinguish API mode and nullability", () => {
	assert.deepEqual(nestedCheckedRecordJvmInputNames, [
		"echoArray", "first", "inArray", "inChoice", "inExcept", "inHolder"
		, "inList", "inOption", "inProduct", "pair", "second"
	]);
	for(const profile of nestedCheckedRecordJvmProfiles)
	{
		const source = nestedCheckedRecordJvmProbeSource(profile);
		for(const name of nestedCheckedRecordJvmInputNames)
			assert.equal(source.match(new RegExp(
				profile === "java" ? `Api\\.${name}\\(` : `Api::${name}\\b`, "gu"
			))?.length, 1);
		assert.doesNotMatch(source, /produceOption|produceArray/u);
	}
	for(const mode of nestedCheckedRecordJvmModes)
	{
		const valid = nestedCheckedRecordKotlinNullSource(mode, false);
		const invalid = nestedCheckedRecordKotlinNullSource(mode, true);
		assert.equal(valid.replaceAll(/Api\.\w+\([^\n]+\)/gu, "CALL")
			, invalid.replaceAll(/Api\.\w+\([^\n]+\)/gu, "CALL"));
		assert.equal(valid.includes("Api.first"), mode === "full");
		assert.equal(invalid.includes("Api.first"), mode === "full");
		assert.ok(valid.includes("Api.produceOption"));
		assert.ok(invalid.includes("Api.produceOption(null)"));
	}
});

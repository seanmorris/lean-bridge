/**
 * Freeze inherited checked-record Maven selections and public caller shape.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	generateCopiedJvmKotlinPackage
} from "../../src/backends/jvm/copied-kotlin.mjs";
import {
	inheritedCheckedRecordJvmCaller
	, inheritedCheckedRecordJvmConfiguration
	, inheritedCheckedRecordJvmCounts
	, inheritedCheckedRecordJvmModes
	, inheritedCheckedRecordJvmProfiles
	, inheritedCheckedRecordJvmReview
	, inheritedCheckedRecordJvmRoutes
	, inheritedCheckedRecordJvmSelection
} from "./inherited-checked-record-jvm-fixture.mjs";

test("inherited checked-record JVM selection is closed and explicit", () => {
	assert.deepEqual(inheritedCheckedRecordJvmRoutes, ["ordinary", "reviewed"]);
	assert.deepEqual(inheritedCheckedRecordJvmModes, ["full", "result-only"]);
	assert.deepEqual(inheritedCheckedRecordJvmProfiles, ["java", "kotlin"]);
	assert.deepEqual(inheritedCheckedRecordJvmSelection({}), {
		enabled: false, routes: [...inheritedCheckedRecordJvmRoutes]
		, modes: [...inheritedCheckedRecordJvmModes], maxLoad: 10
	});
	assert.deepEqual(inheritedCheckedRecordJvmSelection({ CI: "true" }), {
		enabled: false, routes: [...inheritedCheckedRecordJvmRoutes]
		, modes: [...inheritedCheckedRecordJvmModes], maxLoad: 6
	});
	assert.deepEqual(inheritedCheckedRecordJvmSelection({
		LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST: "1"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_ROUTES: "reviewed"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MODES: "result-only"
		, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MAX_LOAD: "12"
	}), {
		enabled: true, routes: ["reviewed"], modes: ["result-only"]
		, maxLoad: 12
	});
	for(const environment of [
		{ LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST: "yes" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_ROUTES: "ordinary,ordinary" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MODES: "unknown" }
		, { LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MAX_LOAD: "14" }
	]) assert.throws(() => inheritedCheckedRecordJvmSelection(environment));
});

test("inherited JVM configuration retains both author routes and API modes", () => {
	for(const route of inheritedCheckedRecordJvmRoutes)
		for(const mode of inheritedCheckedRecordJvmModes)
		{
			const configuration
				= inheritedCheckedRecordJvmConfiguration(route, mode);
			assert.deepEqual(configuration.targets, {
				maven: {
					name: "org.leanbridge:inheritedcheckedrecords"
					, version: "1.0.0"
				}
			});
			assert.deepEqual(configuration.modules, ["InheritedCheckedRecords"]);
			assert.equal(Object.hasOwn(configuration.targets, "c"), false);
			if(route === "ordinary")
			{
				assert.equal(configuration.exports.length
					, mode === "full" ? 8 : 2);
				assert.equal(Object.keys(configuration.contracts ?? {}).length
					, mode === "full" ? 6 : 0);
			}
			else
			{
				assert.equal(configuration.exports, undefined);
				assert.equal(configuration.contracts, undefined);
			}
			assert.equal(inheritedCheckedRecordJvmReview(mode).declarations.length
				, mode === "full" ? 8 : 2);
		}
});

test("inherited JVM projection keeps payloads and erases proof fields", () => {
	for(const mode of inheritedCheckedRecordJvmModes)
	{
		const files = generateCopiedJvmKotlinPackage(
			inheritedCheckedRecordJvmReview(mode));
		for(const prefix of [
			"src/main/java/org/leanbridge/inheritedcheckedrecords/"
			, "src/main/kotlin/org/leanbridge/inheritedcheckedrecords/kotlin/"
		]) {
			const extension = prefix.includes("kotlin") ? "kt" : "java";
			const api = files[prefix + `Api.${extension}`];
			assert.ok(api);
			assert.match(api, /produceStamped/u);
			assert.equal(/\bfirst\b/u.test(api), mode === "full");
			for(const name of ["Span", "Ticket", "Stamped"])
			{
				const source = files[prefix + `${name}.${extension}`];
				assert.ok(source, `${prefix}${name}`);
				assert.doesNotMatch(source
					, /\b(?:ordered|linked|stamped|proof)\b/u);
			}
		}
	}
});

test("inherited JVM callers select only route labels and API sections", async () => {
	for(const profile of inheritedCheckedRecordJvmProfiles)
		for(const route of inheritedCheckedRecordJvmRoutes)
			for(const mode of inheritedCheckedRecordJvmModes)
			{
				const source = await inheritedCheckedRecordJvmCaller(
					profile, route, mode);
				assert.ok(source.includes(
					`PREFIX = "${route === "ordinary" ? "arg" : "value"}"`));
				assert.doesNotMatch(source, /ROUTE_PREFIX|FULL_ONLY/u);
				assert.equal(/Api(?:::|\.)first/u.test(source), mode === "full");
				assert.match(source, /Api(?:::|\.)produce\b/u);
				assert.match(source, /Api(?:::|\.)produceStamped\b/u);
			}
	assert.deepEqual(inheritedCheckedRecordJvmCounts.java
		, inheritedCheckedRecordJvmCounts.kotlin);
});

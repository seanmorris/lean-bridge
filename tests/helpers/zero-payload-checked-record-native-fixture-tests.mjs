/**
 * Lock the public C/C++ representation and independent caller boundaries for
 * zero-payload checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import {
	zeroPayloadCheckedRecordReview
} from "./zero-payload-checked-record-fixture.mjs";
import {
	parseZeroPayloadNativeResult, zeroPayloadNativeCaller
	, zeroPayloadNativeProfiles, zeroPayloadNativeRoutes
	, zeroPayloadNativeSelection
} from "./zero-payload-checked-record-native-fixture.mjs";

test("zero-payload native selections preserve all four author/API routes", () => {
	assert.deepEqual(zeroPayloadNativeProfiles, ["c", "cpp"]);
	assert.deepEqual(zeroPayloadNativeRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	for(const route of zeroPayloadNativeRoutes)
	{
		const selected = zeroPayloadNativeSelection(route);
		assert.deepEqual(selected.configuration.targets, {
			c: { name: "zeropayloadcheckedrecords", version: "1.0.0" }
			, cpp: { name: "zeropayloadcheckedrecords", version: "1.0.0" }
		});
		assert.equal(selected.reviewed, route.endsWith("reviewed-ir"));
		assert.equal(selected.resultOnly, route.startsWith("result-only-"));
		assert.equal(selected.expected.declarations.length
			, selected.resultOnly ? 6 : 11);
	}
});

test("generated C and C++ keep empty, Unit and Option carriers distinct", () => {
	const binding = zeroPayloadCheckedRecordReview();
	const c = generateCBindingPackage(binding)[
		"include/zeropayloadcheckedrecords.h"];
	for(const declaration of [
		"typedef struct zeropayloadcheckedrecords_witness {\n  uint8_t empty;"
		, "typedef struct zeropayloadcheckedrecords_token {\n  uint8_t tag;"
		, "typedef struct zeropayloadcheckedrecords_marker {\n  uint8_t empty;"
		, "uint8_t has_value;\n  zeropayloadcheckedrecords_witness value;"
	]) assert.ok(c.includes(declaration), declaration);
	assert.match(c, /const zeropayloadcheckedrecords_witness \*value0/u);
	assert.match(c, /zeropayloadcheckedrecords_witness \*out/u);
	const cpp = generateCppBindingPackage(binding)[
		"include/zeropayloadcheckedrecords.hpp"];
	assert.match(cpp, /struct Witness \{\n\n {2}friend bool operator==/u);
	assert.match(cpp, /struct Token \{\n {2}std::monostate tag\{\};/u);
	assert.match(cpp, /struct Marker \{\n\n {2}friend bool operator==/u);
	assert.match(cpp, /std::vector<Witness> witnesses\(Nat const& value0\)/u);
	assert.match(cpp, /std::optional<Witness> maybe_witness\(bool value0\)/u);
});

test("zero-payload native callers lock counts and reviewed diagnostics", async () => {
	for(const route of zeroPayloadNativeRoutes)
		for(const profile of zeroPayloadNativeProfiles)
		{
			const caller = await zeroPayloadNativeCaller(profile, route);
			assert.equal(caller.calls, route.startsWith("result-only-") ? 8 : 15);
			assert.equal(caller.rejections
				, route.startsWith("result-only-") ? 0 : 1);
			assert.equal(caller.recoveries, caller.rejections);
			assert.deepEqual(parseZeroPayloadNativeResult(JSON.stringify({
				calls: caller.calls, checks: caller.checks
				, recoveries: caller.recoveries, rejections: caller.rejections
			}), caller), {
				calls: caller.calls, checks: caller.checks
				, recoveries: caller.recoveries, rejections: caller.rejections
			});
			if(!route.startsWith("result-only-"))
			{
				assert.ok(caller.source.includes(route.endsWith("reviewed-ir")
					? "value0 was rejected" : "arg0 was rejected"));
				assert.ok(caller.source.includes("mkAbsent"));
			}
		}
});

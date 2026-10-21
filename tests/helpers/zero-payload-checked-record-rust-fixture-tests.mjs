/**
 * Cheap source-contract controls for zero-payload Rust packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	generateCopiedRustPackage
} from "../../src/backends/rust/copied-values.mjs";
import {
	zeroPayloadBrowserInputNames, zeroPayloadBrowserResultNames
	, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	parseZeroPayloadRustResult, zeroPayloadRustCaller
	, zeroPayloadRustConfiguration, zeroPayloadRustCounts
	, zeroPayloadRustFeatures, zeroPayloadRustModes, zeroPayloadRustRoutes
	, zeroPayloadRustSelection, zeroPayloadRustTarget
} from "./zero-payload-checked-record-rust-fixture.mjs";

test("zero-payload Rust selections retain four routes and two API modes", () => {
	assert.deepEqual(zeroPayloadRustRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(zeroPayloadRustTarget, {
		name: "zeropayloadcheckedrecords", version: "1.0.0"
	});
	assert.deepEqual(zeroPayloadRustModes, ["full", "result-only"]);
	for(const route of zeroPayloadRustRoutes)
	{
		const selection = zeroPayloadBrowserSelection(route);
		assert.deepEqual(zeroPayloadRustConfiguration(route), {
			...selection.configuration, targets: { cargo: zeroPayloadRustTarget }
		});
		assert.deepEqual(zeroPayloadRustFeatures(route), [
			...selection.resultOnly ? ["result-only"] : []
			, ...selection.reviewed ? ["reviewed"] : []
		]);
	}
	assert.deepEqual(zeroPayloadRustSelection({}), {
		enabled: false, routes: zeroPayloadRustRoutes, maxLoad: 12
	});
	assert.deepEqual(zeroPayloadRustSelection({
		LEAN_BRIDGE_ZERO_PAYLOAD_RUST_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_RUST_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_RUST_MAX_LOAD: "6"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 6 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_RUST_TEST: "2" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUST_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUST_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_RUST_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUST_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_RUST_MODES: "full" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUST_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_RUST_MAX_LOAD: "7" }
	]) assert.throws(() => zeroPayloadRustSelection(environment));
	assert.throws(() => zeroPayloadRustConfiguration("missing"));
});

test("Rust bindings preserve empty, Unit, Option, array and variant identity", () => {
	for(const route of zeroPayloadRustRoutes)
	{
		const selection = zeroPayloadBrowserSelection(route);
		const files = generateCopiedRustPackage(
			selection.expected, null, zeroPayloadRustTarget
		);
		const source = files["src/lib.rs"];
		assert.match(source, /pub struct Witness \{\n\n\}/u);
		assert.match(source, /pub struct Token \{\n {4}pub tag: \(\),\n\}/u);
		assert.match(source, /pub struct Marker \{\n\n\}/u);
		assert.match(source
			, /pub enum Mark \{\n {4}Blank,\n {4}Marked \{ witness: Witness \},\n\}/u);
		for(const name of zeroPayloadBrowserInputNames)
			assert.equal(source.includes(`pub fn ${name.replace(
				/([A-Z])/gu, "_$1").toLowerCase()}(`), !selection.resultOnly);
		for(const name of zeroPayloadBrowserResultNames)
			assert.ok(source.includes(`pub fn ${name.replace(
				/([A-Z])/gu, "_$1").toLowerCase()}(`));
	}
});

test("independent Rust caller retains layout, refusal and branch controls"
	, async () => {
		const caller = await zeroPayloadRustCaller();
		for(const mode of zeroPayloadRustModes)
		{
			const value = zeroPayloadRustCounts[mode];
			assert.deepEqual(parseZeroPayloadRustResult(
				`${JSON.stringify(value)}\n`, mode), value);
		}
		assert.match(caller, /size_of::<Witness>\(\) == 0/u);
		assert.match(caller, /size_of::<Token>\(\) == 0/u);
		assert.match(caller, /size_of::<Marker>\(\) == 0/u);
		assert.match(caller, /rejected by ZeroPayloadCheckedRecords\.mkAbsent/u);
		assert.match(caller, /Mark::Blank/u);
		assert.match(caller, /Mark::Marked \{ witness: witness\(\) \}/u);
		assert.throws(() => parseZeroPayloadRustResult("{}\n", "full"));
	}
);

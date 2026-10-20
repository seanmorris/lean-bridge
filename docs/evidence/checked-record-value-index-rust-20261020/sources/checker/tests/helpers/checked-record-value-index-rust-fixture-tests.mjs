/**
 * Cheap Rust source-contract controls for closed checked-record value indices.
 * Installed crate acceptance is a separate opt-in lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { copiedRustLock, generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import {
	checkedRecordValueIndexBrowserSelection, checkedRecordValueIndexInputNames
	, checkedRecordValueIndexResultNames
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexRustCaller, checkedRecordValueIndexRustConfiguration
	, checkedRecordValueIndexRustCounts, checkedRecordValueIndexRustFeatures
	, checkedRecordValueIndexRustModes, checkedRecordValueIndexRustRoutes
	, checkedRecordValueIndexRustSelection, checkedRecordValueIndexRustTarget
	, parseCheckedRecordValueIndexRustResult
} from "./checked-record-value-index-rust-fixture.mjs";
import {
	checkedRecordValueIndexRustConsumerLock, checkedRecordValueIndexRustLockedPackages
} from "./checked-record-value-index-rust-dependency-records.mjs";
import {
	checkCheckedRecordValueIndexRustApiProbe, checkedRecordValueIndexRustCargoArguments
	, checkedRecordValueIndexRustPublicInputs
} from "./checked-record-value-index-rust-install.mjs";

test("value-index Rust selections retain all four author routes and both API modes", () => {
	assert.deepEqual(checkedRecordValueIndexRustRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(checkedRecordValueIndexRustTarget, {
		name: "checkedrecordvalueindices", version: "1.0.0"
	});
	assert.deepEqual(checkedRecordValueIndexRustModes, ["full", "result-only"]);
	for(const route of checkedRecordValueIndexRustRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		assert.deepEqual(checkedRecordValueIndexRustConfiguration(route), {
			...selection.configuration, targets: { cargo: checkedRecordValueIndexRustTarget }
		});
		assert.deepEqual(checkedRecordValueIndexRustFeatures(route), [
			...selection.resultOnly ? ["result-only"] : []
			, ...selection.reviewed ? ["reviewed"] : []
		]);
	}
	assert.deepEqual(checkedRecordValueIndexRustSelection({}), {
		enabled: false, routes: checkedRecordValueIndexRustRoutes, maxLoad: 12
	});
	assert.deepEqual(checkedRecordValueIndexRustSelection({
		LEAN_BRIDGE_VALUE_INDEX_RUST_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_RUST_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_VALUE_INDEX_RUST_MAX_LOAD: "6"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 6 });
	for(const environment of [
		{ LEAN_BRIDGE_VALUE_INDEX_RUST_TEST: "2" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUST_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUST_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_RUST_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUST_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_RUST_MODES: "full" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUST_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_RUST_MAX_LOAD: "7" }
	]) assert.throws(() => checkedRecordValueIndexRustSelection(environment));
	assert.throws(() => checkedRecordValueIndexRustConfiguration("missing"));
});

test("Rust copied bindings retain every compiler-derived closed index and API boundary", async () => {
	for(const route of checkedRecordValueIndexRustRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		const files = generateCopiedRustPackage(selection.expected, null, checkedRecordValueIndexRustTarget);
		const publicSource = files["src/lib.rs"];
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.equal(manifest.component, "checkedrecordvalueindices@1.0.0");
		for(const type of selection.expected.types)
			assert.match(publicSource, new RegExp(`pub struct ${type.name}`, "u"));
		for(const declaration of selection.expected.declarations)
			assert.match(publicSource, new RegExp(`pub fn ${declaration.name.replace(/([A-Z])/gu, "_$1").toLowerCase()}\\(`, "u"));
		for(const name of checkedRecordValueIndexInputNames)
			assert.equal(publicSource.includes(`pub fn ${name.replace(/([A-Z])/gu, "_$1").toLowerCase()}(`), !selection.resultOnly);
		for(const name of checkedRecordValueIndexResultNames)
			assert.ok(publicSource.includes(`pub fn ${name.replace(/([A-Z])/gu, "_$1").toLowerCase()}(`));
	}
	const caller = await checkedRecordValueIndexRustCaller();
	assert.match(caller, /Independent Rust caller/u);
	assert.match(caller, /checkedrecordvalueindices as api/u);
	assert.match(caller, /cfg\(not\(feature = "result-only"\)\)/u);
	assert.match(caller, /#\[cfg\(not\(feature = "result-only"\)\)\]\nuse api::Error;/u);
	assert.match(caller, /#\[cfg\(not\(feature = "result-only"\)\)\]\n    fn call/u);
	assert.match(caller, /#\[cfg\(not\(feature = "result-only"\)\)\]\nfn wide/u);
});

test("independent Rust caller retains constructor refusals, recovery and result-only boundaries", async () => {
	const caller = await checkedRecordValueIndexRustCaller();
	for(const mode of checkedRecordValueIndexRustModes)
	{
		const value = checkedRecordValueIndexRustCounts[mode];
		assert.deepEqual(parseCheckedRecordValueIndexRustResult(`${JSON.stringify(value)}\n`, mode), value);
	}
	assert.match(caller, /rejection\("mkAb"\)/u);
	assert.match(caller, /rejection\("mkEmptySized"\)/u);
	assert.match(caller, /rejection\("mkOn"\)/u);
	assert.match(caller, /rejection\("mkOff"\)/u);
	assert.match(caller, /let huge = wide\(\);/u);
	assert.throws(() => parseCheckedRecordValueIndexRustResult("{}\n", "full"));
});

test("Rust offline controls close dependency locks, features, and result-only inputs", async () => {
	assert.deepEqual(checkedRecordValueIndexRustCargoArguments("ordinary-source")
		, ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"]);
	assert.deepEqual(checkedRecordValueIndexRustCargoArguments("result-only-reviewed-ir")
		, ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"
			, "--features", "result-only,reviewed"]);
	const lock = await copiedRustLock("checkedrecordvalueindices", "1.0.0");
	const packages = checkedRecordValueIndexRustLockedPackages(lock);
	assert.equal(packages.length, 15);
	assert.match(checkedRecordValueIndexRustConsumerLock(lock)
		, /name = "value-index-consumer"\nversion = "0\.0\.0"/u);
	assert.deepEqual(checkCheckedRecordValueIndexRustApiProbe({
		code: 0, stderr: "", stdout: '{"reason":"build-finished","success":true}\n'
	}, false), { absent: [], present: checkedRecordValueIndexRustPublicInputs });
	const message = checkedRecordValueIndexRustPublicInputs
		.map(name => `\`checkedrecordvalueindices::${name}\``).join(", ");
	const diagnostics = [
		{
			reason: "compiler-message"
			, message: {
				level: "error"
				, code: { code: "E0432" }
				, message
				, spans: [{ is_primary: true, file_name: "src/bin/api-probe.rs" }]
			}
		}
		, { reason: "build-finished", success: false }
	].map(value => JSON.stringify(value)).join("\n") + "\n";
	assert.deepEqual(checkCheckedRecordValueIndexRustApiProbe({
		code: 101, stderr: "", stdout: diagnostics
	}, true), { absent: checkedRecordValueIndexRustPublicInputs, present: [] });
});

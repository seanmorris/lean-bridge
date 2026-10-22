/**
 * Cheap Rust source-contract controls for dependent checked records.
 * Installed crate acceptance is a separate opt-in lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { copiedRustLock, generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import {
	dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordRustCaller, dependentCheckedRecordRustConfiguration
	, dependentCheckedRecordRustCounts, dependentCheckedRecordRustFeatures
	, dependentCheckedRecordRustModes, dependentCheckedRecordRustRoutes
	, dependentCheckedRecordRustSelection, dependentCheckedRecordRustTarget
	, parseDependentCheckedRecordRustResult
} from "./dependent-checked-record-rust-fixture.mjs";
import {
	dependentCheckedRecordRustConsumerLock, dependentCheckedRecordRustLockedPackages
} from "./dependent-checked-record-rust-dependency-records.mjs";
import {
	checkDependentCheckedRecordRustApiProbe, dependentCheckedRecordRustCargoArguments
	, dependentCheckedRecordRustPublicInputs
} from "./dependent-checked-record-rust-install.mjs";

test("dependent checked-record Rust selections retain all four author routes and both API modes", () => {
	assert.deepEqual(dependentCheckedRecordRustRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(dependentCheckedRecordRustTarget, {
		name: "dependentrecords", version: "1.0.0"
	});
	assert.deepEqual(dependentCheckedRecordRustModes, ["full", "result-only"]);
	for(const route of dependentCheckedRecordRustRoutes)
	{
		const selection = dependentCheckedRecordSelection(route);
		assert.deepEqual(dependentCheckedRecordRustConfiguration(route), {
			...selection.configuration, targets: { cargo: dependentCheckedRecordRustTarget }
		});
		assert.deepEqual(dependentCheckedRecordRustFeatures(route), [
			...selection.resultOnly ? ["result-only"] : []
			, ...selection.reviewed ? ["reviewed"] : []
		]);
	}
	assert.deepEqual(dependentCheckedRecordRustSelection({}), {
		enabled: false, routes: dependentCheckedRecordRustRoutes, maxLoad: 12
	});
	assert.deepEqual(dependentCheckedRecordRustSelection({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_MAX_LOAD: "6"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 6 });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_TEST: "2" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_MODES: "full" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUST_MAX_LOAD: "7" }
	]) assert.throws(() => dependentCheckedRecordRustSelection(environment));
	assert.throws(() => dependentCheckedRecordRustConfiguration("missing"));
});

test("Rust copied bindings retain the erased proof, dynamic field dependency and API boundary", async () => {
	for(const route of dependentCheckedRecordRustRoutes)
	{
		const selection = dependentCheckedRecordSelection(route);
		const files = generateCopiedRustPackage(selection.expected, null, dependentCheckedRecordRustTarget);
		const publicSource = files["src/lib.rs"];
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.equal(manifest.component, "dependentrecords@1.0.0");
		assert.equal(selection.expected.types.length, 1);
		assert.deepEqual(selection.expected.types[0].source.extensions, {
			"lean-lang.org/erased-proofs": { fields: ["valid"] }
			, "lean-lang.org/nominal-refinements": {
				kind: "record", fields: [null, { kind: "fin-field", field: "bound" }]
			}
		});
		for(const type of selection.expected.types)
			assert.match(publicSource, new RegExp(`pub struct ${type.name}`, "u"));
		for(const declaration of selection.expected.declarations)
			assert.match(publicSource, new RegExp(`pub fn ${declaration.name.replace(/([A-Z])/gu, "_$1").toLowerCase()}\\(`, "u"));
		assert.equal(publicSource.includes("pub fn dependent_total("), !selection.resultOnly);
		assert.equal(publicSource.includes("pub fn dependent_roundtrip("), !selection.resultOnly);
		assert.ok(publicSource.includes("pub fn dependent_result("));
	}
	const caller = await dependentCheckedRecordRustCaller();
	assert.match(caller, /Independent Rust caller/u);
	assert.match(caller, /dependentrecords as api/u);
	assert.match(caller, /cfg\(not\(feature = "result-only"\)\)/u);
	assert.match(caller, /#\[cfg\(not\(feature = "result-only"\)\)\]\nuse api::Error;/u);
	assert.match(caller, /#\[cfg\(not\(feature = "result-only"\)\)\]\n {4}fn call/u);
	assert.match(caller, /n\(1\) << 130usize/u);
});

test("independent Rust caller retains constructor refusals, recovery and result-only boundaries", async () => {
	const caller = await dependentCheckedRecordRustCaller();
	for(const mode of dependentCheckedRecordRustModes)
	{
		const value = dependentCheckedRecordRustCounts[mode];
		assert.deepEqual(parseDependentCheckedRecordRustResult(`${JSON.stringify(value)}\n`, mode), value);
	}
	assert.match(caller, /DependentRecords\.mkDependent/u);
	assert.match(caller, /counts\.refuse\(&dependent\(n\(2\), n\(2\)\), "equal fields"\)/u);
	assert.match(caller, /counts\.refuse\(&dependent\(n\(0\), n\(0\)\), "zero bound"\)/u);
	assert.match(caller, /for index in 0u64\.\.256/u);
	assert.match(caller, /let huge = n\(1\) << 130usize;/u);
	assert.throws(() => parseDependentCheckedRecordRustResult("{}\n", "full"));
});

test("Rust offline controls close dependency locks, features, and result-only inputs", async () => {
	assert.deepEqual(dependentCheckedRecordRustCargoArguments("ordinary-source")
		, ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"]);
	assert.deepEqual(dependentCheckedRecordRustCargoArguments("result-only-reviewed-ir")
		, ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"
			, "--features", "result-only,reviewed"]);
	const lock = await copiedRustLock("dependentrecords", "1.0.0");
	const packages = dependentCheckedRecordRustLockedPackages(lock);
	assert.equal(packages.length, 15);
	assert.match(dependentCheckedRecordRustConsumerLock(lock)
		, /name = "dependent-record-consumer"\nversion = "0\.0\.0"/u);
	assert.deepEqual(checkDependentCheckedRecordRustApiProbe({
		code: 0, stderr: "", stdout: '{"reason":"build-finished","success":true}\n'
	}, false), { absent: [], present: dependentCheckedRecordRustPublicInputs });
	const message = dependentCheckedRecordRustPublicInputs
		.map(name => `\`dependentrecords::${name}\``).join(", ");
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
	assert.deepEqual(checkDependentCheckedRecordRustApiProbe({
		code: 101, stderr: "", stdout: diagnostics
	}, true), { absent: dependentCheckedRecordRustPublicInputs, present: [] });
});

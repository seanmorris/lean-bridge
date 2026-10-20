/**
 * Cheap Ruby source-contract controls for closed checked-record value indices.
 * Installed gem acceptance is a separate opt-in lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexInputNames
	, checkedRecordValueIndexResultNames
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexRubyCaller, checkedRecordValueIndexRubyCallerArgs
	, checkedRecordValueIndexRubyConfiguration, checkedRecordValueIndexRubyCounts
	, checkedRecordValueIndexRubyModes, checkedRecordValueIndexRubyNamespace
	, checkedRecordValueIndexRubyRequirePath, checkedRecordValueIndexRubyRoutes
	, checkedRecordValueIndexRubySelection, checkedRecordValueIndexRubyTarget
	, parseCheckedRecordValueIndexRubyResult
} from "./checked-record-value-index-ruby-fixture.mjs";
import {
	assertCheckedRecordValueIndexRubyIdentity
	, checkedRecordValueIndexRubyNativeEvidence
} from "./checked-record-value-index-ruby-package.mjs";

test("value-index Ruby selections retain all four author routes and both API modes", () => {
	assert.deepEqual(checkedRecordValueIndexRubyRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(checkedRecordValueIndexRubyTarget, {
		name: "checkedrecordvalueindices", version: "1.0.0"
	});
	assert.equal(checkedRecordValueIndexRubyRequirePath, "lean_bridge/checkedrecordvalueindices");
	assert.equal(checkedRecordValueIndexRubyNamespace, "LeanBridge::Checkedrecordvalueindices");
	assert.deepEqual(checkedRecordValueIndexRubyModes, ["full", "result-only"]);
	for(const route of checkedRecordValueIndexRubyRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		assert.deepEqual(checkedRecordValueIndexRubyConfiguration(route), {
			...selection.configuration, targets: { rubygems: checkedRecordValueIndexRubyTarget }
		});
		assert.deepEqual(checkedRecordValueIndexRubyCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.deepEqual(checkedRecordValueIndexRubySelection({}), {
		enabled: false, routes: checkedRecordValueIndexRubyRoutes, maxLoad: 12
	});
	assert.deepEqual(checkedRecordValueIndexRubySelection({
		LEAN_BRIDGE_VALUE_INDEX_RUBY_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_RUBY_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_VALUE_INDEX_RUBY_MAX_LOAD: "8"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 8 });
	for(const environment of [
		{ LEAN_BRIDGE_VALUE_INDEX_RUBY_TEST: "2" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUBY_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUBY_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_RUBY_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUBY_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_RUBY_MODES: "full" }
		, { LEAN_BRIDGE_VALUE_INDEX_RUBY_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_RUBY_MAX_LOAD: "7" }
	]) assert.throws(() => checkedRecordValueIndexRubySelection(environment));
	assert.throws(() => checkedRecordValueIndexRubyConfiguration("missing", "full"));
});

test("Ruby copied bindings retain every compiler-derived closed index and API boundary", async () => {
	for(const route of checkedRecordValueIndexRubyRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		const files = generateCopiedRubyPackage(selection.expected);
		const publicSource = files[`lib/${checkedRecordValueIndexRubyRequirePath}.rb`];
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.equal(manifest.component, "checkedrecordvalueindices@1.0.0");
		assert.equal(manifest.namespace, checkedRecordValueIndexRubyNamespace);
		assert.equal(manifest.bindingIrSha256.length, 64);
		for(const type of selection.expected.types)
			assert.match(publicSource, new RegExp(`class ${type.name}`, "u"));
		for(const declaration of selection.expected.declarations)
			assert.match(publicSource, new RegExp(`def ${declaration.name.replace(/([A-Z])/gu, "_$1").toLowerCase()}\\(`, "u"));
		for(const name of checkedRecordValueIndexInputNames)
			assert.equal(publicSource.includes(`def ${name.replace(/([A-Z])/gu, "_$1").toLowerCase()}(`), !selection.resultOnly);
		for(const name of checkedRecordValueIndexResultNames)
			assert.ok(publicSource.includes(`def ${name.replace(/([A-Z])/gu, "_$1").toLowerCase()}(`));
	}
	const caller = await checkedRecordValueIndexRubyCaller();
	assert.match(caller, /Independent Ruby caller/u);
	assert.match(caller, /CheckedRecordValueIndices/u);
});

test("Ruby package identity binds the original gem receipt to its native loader", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }
		, sourceIdentity: { fixture: true } };
	const pkg = { target: "rubygems", ecosystem: "rubygems", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, ...checkedRecordValueIndexRubyTarget, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/checkedrecordvalueindices-1.0.0-x86_64-linux.gem" }] };
	const receipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-rubygems-package"
		, ecosystem: "rubygems", namespace: checkedRecordValueIndexRubyNamespace
		, requirePath: checkedRecordValueIndexRubyRequirePath
		, ...checkedRecordValueIndexRubyTarget
		, runtimeIdentity: pkg.runtimeIdentity, bindingIrSha256: model.bindingIrSha256
		, component: model.component
		, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion: "2.38"
		, files: { "lib/lean_bridge/checkedrecordvalueindices/native/linux-x64/a.so": { sha256: "c".repeat(64) }
			, "lib/lean_bridge/checkedrecordvalueindices/native/linux-x64/component.so": { sha256: "d".repeat(64) } } };
	assert.doesNotThrow(() => assertCheckedRecordValueIndexRubyIdentity(receipt, pkg, model, "2.38"));
	assert.throws(() => assertCheckedRecordValueIndexRubyIdentity({ ...receipt, requirePath: "other" }, pkg, model, "2.38"));
	const runtime = { files: { "lib/a.so": { sha256: "c".repeat(64) } } };
	const component = { runtimeIdentity: sha256(canonicalJson(runtime))
		, bindingIrSha256: model.bindingIrSha256
		, library: "component.so"
		, nativeLibrary: { sha256: "d".repeat(64) } };
	const adapter = { runtimeIdentity: component.runtimeIdentity
		, bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: "a.so", files: { "lib/a.so": { sha256: "c".repeat(64) } } };
	const nativeReceipt = { ...receipt, runtimeIdentity: component.runtimeIdentity
		, files: receipt.files };
	assert.deepEqual(checkedRecordValueIndexRubyNativeEvidence(nativeReceipt, component, adapter, runtime), {
		runtimeIdentity: component.runtimeIdentity, componentId: "synthetic"
		, componentReceiptSha256: adapter.componentReceiptSha256, library: "a.so"
		, libraries: { "a.so": "c".repeat(64), "component.so": "d".repeat(64) }
	});
});

test("independent Ruby caller detects a wrong value, preserves rejected inputs, and recovers", async t => {
	const ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby";
	for(const route of checkedRecordValueIndexRubyRoutes)
	{
		const mode = route.startsWith("result-only-") ? "result-only" : "full";
		const stdout = execFileSync(ruby, [
			"tests/helpers/checked-record-value-index-ruby-model.rb"
			, "tests/fixtures/checked-record-value-index-ruby/ruby.rb"
			, ...checkedRecordValueIndexRubyCallerArgs(route)
		], { encoding: "utf8" });
		assert.deepEqual(parseCheckedRecordValueIndexRubyResult(stdout, mode), checkedRecordValueIndexRubyCounts[mode]);
		t.diagnostic(`${route}: immutable caller model passed`);
	}
	assert.match(await readFile("tests/helpers/checked-record-value-index-ruby-model.rb", "utf8"), /Independent model/u);
});

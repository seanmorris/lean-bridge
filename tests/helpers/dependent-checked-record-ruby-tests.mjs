/**
 * Cheap Ruby source-contract controls for dependent checked records.
 * Installed gem acceptance is a separate opt-in lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordRubyCaller, dependentCheckedRecordRubyCallerArgs
	, dependentCheckedRecordRubyConfiguration, dependentCheckedRecordRubyCounts
	, dependentCheckedRecordRubyModes, dependentCheckedRecordRubyNamespace
	, dependentCheckedRecordRubyRequirePath, dependentCheckedRecordRubyRoutes
	, dependentCheckedRecordRubySelection, dependentCheckedRecordRubyTarget
	, parseDependentCheckedRecordRubyResult
} from "./dependent-checked-record-ruby-fixture.mjs";
import {
	assertDependentCheckedRecordRubyIdentity
	, dependentCheckedRecordRubyNativeEvidence
} from "./dependent-checked-record-ruby-package.mjs";
import {
	assertDependentCheckedRecordRubyCiTap, dependentCheckedRecordRubyCiTestName
	, dependentCheckedRecordRubyReceiptChecksum, parseDependentCheckedRecordRubyCiArgs
} from "./dependent-checked-record-ruby-ci-report.mjs";

test("dependent checked-record Ruby selections retain all four author routes and both API modes", () => {
	assert.deepEqual(dependentCheckedRecordRubyRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(dependentCheckedRecordRubyTarget, {
		name: "dependentrecords", version: "1.0.0"
	});
	assert.equal(dependentCheckedRecordRubyRequirePath, "lean_bridge/dependentrecords");
	assert.equal(dependentCheckedRecordRubyNamespace, "LeanBridge::Dependentrecords");
	assert.deepEqual(dependentCheckedRecordRubyModes, ["full", "result-only"]);
	for(const route of dependentCheckedRecordRubyRoutes)
	{
		const selection = dependentCheckedRecordSelection(route);
		assert.deepEqual(dependentCheckedRecordRubyConfiguration(route), {
			...selection.configuration, targets: { rubygems: dependentCheckedRecordRubyTarget }
		});
		assert.deepEqual(dependentCheckedRecordRubyCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.deepEqual(dependentCheckedRecordRubySelection({}), {
		enabled: false, routes: dependentCheckedRecordRubyRoutes, maxLoad: 12
	});
	assert.deepEqual(dependentCheckedRecordRubySelection({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_MAX_LOAD: "8"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 8 });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "2" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_MODES: "full" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_MAX_LOAD: "7" }
	]) assert.throws(() => dependentCheckedRecordRubySelection(environment));
	assert.throws(() => dependentCheckedRecordRubyConfiguration("missing", "full"));
});

test("Ruby copied bindings retain the dynamic Fin field dependency and API boundary", async () => {
	for(const route of dependentCheckedRecordRubyRoutes)
	{
		const selection = dependentCheckedRecordSelection(route);
		const files = generateCopiedRubyPackage(selection.expected);
		const publicSource = files[`lib/${dependentCheckedRecordRubyRequirePath}.rb`];
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.equal(manifest.component, "dependentrecords@1.0.0");
		assert.equal(manifest.namespace, dependentCheckedRecordRubyNamespace);
		assert.equal(manifest.bindingIrSha256.length, 64);
		assert.deepEqual(selection.expected.types[0].source.extensions, {
			"lean-lang.org/erased-proofs": { fields: ["valid"] }
			, "lean-lang.org/nominal-refinements": {
				kind: "record", fields: [null, { kind: "fin-field", field: "bound" }]
			}
		});
		assert.match(publicSource, /class Dependent/u);
		for(const declaration of selection.expected.declarations)
			assert.match(publicSource, new RegExp(`def ${declaration.name.replace(/([A-Z])/gu, "_$1").toLowerCase()}\\(`, "u"));
		assert.equal(publicSource.includes("def dependent_total("), !selection.resultOnly);
		assert.equal(publicSource.includes("def dependent_roundtrip("), !selection.resultOnly);
		assert.ok(publicSource.includes("def dependent_result("));
	}
	const caller = await dependentCheckedRecordRubyCaller();
	assert.match(caller, /Independent Ruby caller/u);
	assert.match(caller, /DependentRecords\.mkDependent/u);
	assert.match(caller, /1 << 130/u);
});

test("Ruby package identity binds the original gem receipt to its native loader", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }
		, sourceIdentity: { fixture: true } };
	const pkg = { target: "rubygems", ecosystem: "rubygems", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, ...dependentCheckedRecordRubyTarget, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/dependentrecords-1.0.0-x86_64-linux.gem" }] };
	const receipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-rubygems-package"
		, ecosystem: "rubygems", namespace: dependentCheckedRecordRubyNamespace
		, requirePath: dependentCheckedRecordRubyRequirePath
		, ...dependentCheckedRecordRubyTarget
		, runtimeIdentity: pkg.runtimeIdentity, bindingIrSha256: model.bindingIrSha256
		, component: model.component
		, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion: "2.38"
		, files: { "lib/lean_bridge/dependentrecords/native/linux-x64/a.so": { sha256: "c".repeat(64) }
			, "lib/lean_bridge/dependentrecords/native/linux-x64/component.so": { sha256: "d".repeat(64) } } };
	assert.doesNotThrow(() => assertDependentCheckedRecordRubyIdentity(receipt, pkg, model, "2.38"));
	assert.throws(() => assertDependentCheckedRecordRubyIdentity({ ...receipt, requirePath: "other" }, pkg, model, "2.38"));
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
	assert.deepEqual(dependentCheckedRecordRubyNativeEvidence(nativeReceipt, component, adapter, runtime), {
		runtimeIdentity: component.runtimeIdentity, componentId: "synthetic"
		, componentReceiptSha256: adapter.componentReceiptSha256, library: "a.so"
		, libraries: { "a.so": "c".repeat(64), "component.so": "d".repeat(64) }
	});
});

test("independent Ruby caller preserves dependent refusals, recovery and huge Nats", async t => {
	const ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby";
	for(const route of dependentCheckedRecordRubyRoutes)
	{
		const mode = route.startsWith("result-only-") ? "result-only" : "full";
		const stdout = execFileSync(ruby, [
			"tests/helpers/dependent-checked-record-ruby-model.rb"
			, "tests/fixtures/dependent-checked-record-consumers/ruby.rb"
			, ...dependentCheckedRecordRubyCallerArgs(route)
		], { encoding: "utf8" });
		assert.deepEqual(parseDependentCheckedRecordRubyResult(stdout, mode), dependentCheckedRecordRubyCounts[mode]);
		t.diagnostic(`${route}: immutable caller model passed`);
	}
	assert.match(await readFile(
		"tests/helpers/dependent-checked-record-ruby-model.rb", "utf8"
	), /Independent contract oracle/u);
});

test("dependent checked-record Ruby hosted checker closes each route and its complete TAP stream", () => {
	assert.equal(dependentCheckedRecordRubyReceiptChecksum(Buffer.from("receipt\n"))
		, `${sha256(Buffer.from("receipt\n"))}  package-set-receipt.json\n`);
	const options = {
		route: "ordinary-source"
		, producer: "a".repeat(40)
		, directory: "records"
		, tap: "records/run.tap"
		, glibc: "2.38"
		, ruby: "/opt/ruby/bin/ruby"
	};
	const args = Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]);
	assert.deepEqual(parseDependentCheckedRecordRubyCiArgs(args), options);
	const name = dependentCheckedRecordRubyCiTestName(options.route);
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
	assertDependentCheckedRecordRubyCiTap(tap, options.route);
	for(const changed of [
		args.slice(2)
		, [...args, "--route", options.route]
		, args.with(1, "ordinary")
		, args.with(args.indexOf("--ruby") + 1, "ruby")
	]) assert.throws(() => parseDependentCheckedRecordRubyCiArgs(changed));
	for(const changed of [
		tap.replace("# fail 0", "# fail 1")
		, tap.replace("ok 1", "not ok 1")
		, tap.replace("# skipped 0", "# skipped 1")
	]) assert.throws(() => assertDependentCheckedRecordRubyCiTap(changed, options.route));
});

test("dependent checked-record Ruby workflow covers every closed route and retains failed records", async () => {
	const workflow = await readFile(".github/workflows/dependent-checked-record-ruby.yml", "utf8");
	const runner = await readFile("scripts/run-dependent-checked-record-ruby-ci.sh", "utf8");
	const verifyWorkflow = source => {
		assert.ok(source.startsWith("name: Installed dependent checked records in Ruby\n"));
		for(const required of [
			"on:\n  workflow_dispatch:\n"
			, "runs-on: ubuntu-24.04"
			, "timeout-minutes: 180"
			, "timeout-minutes: 120"
			, "ruby-version: '3.3.12'"
			, "persist-credentials: false"
			, "bash scripts/run-dependent-checked-record-ruby-ci.sh"
			, "if: always()\n        uses: actions/upload-artifact@v7"
			, "if-no-files-found: error"
			, "if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1"
		]) assert.ok(source.includes(required), required);
		assert.doesNotMatch(source, /continue-on-error:|strategy:|matrix:|needs:/u);
	};
	verifyWorkflow(workflow);
	for(const changed of [
		workflow.replace("workflow_dispatch:\n", "")
		, workflow.replace("persist-credentials: false", "persist-credentials: true")
		, workflow.replace("if-no-files-found: error", "if-no-files-found: warn")
		, workflow.replace("timeout-minutes: 120", "timeout-minutes: 10")
	]) assert.throws(() => verifyWorkflow(changed));
	assert.match(runner, /set -euo pipefail/u);
	assert.match(runner, /ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir/u);
	assert.match(runner, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.38/u);
	assert.match(runner, /--producer "\$revision" --directory "\$output\/records\/\$route"/u);
	assert.match(runner, /--glibc 2\.38 --ruby "\$LEAN_BRIDGE_RUBY"/u);
	assert.doesNotMatch(runner, /curl|gem install .*https?:/u);
});

test("dependent checked-record Ruby installed gate refuses partial selections", () => {
	const base = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith(
			"LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_"
		) && key !== "NODE_TEST_CONTEXT"));
	const invoke = changes => spawnSync(process.execPath, [
		"--test", "--test-reporter=tap"
		, "tests/helpers/dependent-checked-record-ruby-installed-tests.mjs"
	], { env: { ...base, ...changes }, encoding: "utf8", timeout: 15_000 });
	const disabled = invoke({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "0"
	});
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "0"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_MAX_LOAD: "7" }
	]) {
		const result = invoke(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /reproducible Ruby gem/u);
	}
});

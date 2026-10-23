/**
 * Cheap Ruby source-contract controls for zero-payload checked records.
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
	zeroPayloadBrowserInputNames, zeroPayloadBrowserResultNames
	, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	parseZeroPayloadRubyResult, zeroPayloadRubyCaller, zeroPayloadRubyCallerArgs
	, zeroPayloadRubyConfiguration, zeroPayloadRubyCounts, zeroPayloadRubyEnvironment
	, zeroPayloadRubyModes, zeroPayloadRubyNamespace, zeroPayloadRubyRequirePath
	, zeroPayloadRubyRoutes, zeroPayloadRubyTarget
} from "./zero-payload-checked-record-ruby-fixture.mjs";
import {
	assertZeroPayloadRubyIdentity, zeroPayloadRubyNativeEvidence
} from "./zero-payload-checked-record-ruby-package.mjs";
import {
	assertZeroPayloadRubyCiTap, parseZeroPayloadRubyCiArgs
	, zeroPayloadRubyCiTestName, zeroPayloadRubyReceiptChecksum
} from "./zero-payload-checked-record-ruby-ci-report.mjs";

const snake = name => name.replace(/([A-Z])/gu, "_$1").toLowerCase();
const rubyCommand = () => process.env.LEAN_BRIDGE_RUBY ?? "/usr/bin/ruby";
const rubyModelAvailable = process.env.LEAN_BRIDGE_RUBY !== undefined
	|| spawnSync(rubyCommand(), ["-e", "exit defined?(Data) ? 0 : 1"]
		, { stdio: "ignore" }).status === 0;

test("zero-payload Ruby selections retain all four author routes and both API modes", () => {
	assert.deepEqual(zeroPayloadRubyRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(zeroPayloadRubyTarget, { name: "zeropayloadcheckedrecords", version: "1.0.0" });
	assert.equal(zeroPayloadRubyRequirePath, "lean_bridge/zeropayloadcheckedrecords");
	assert.equal(zeroPayloadRubyNamespace, "LeanBridge::Zeropayloadcheckedrecords");
	assert.deepEqual(zeroPayloadRubyModes, ["full", "result-only"]);
	for(const route of zeroPayloadRubyRoutes)
	{
		const selection = zeroPayloadBrowserSelection(route);
		const configuration = zeroPayloadRubyConfiguration(route);
		assert.deepEqual(configuration, {
			...selection.configuration, targets: { rubygems: zeroPayloadRubyTarget }
		});
		assert.deepEqual(configuration.modules, ["ZeroPayloadCheckedRecords"]);
		assert.equal(configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 6 : 11);
		assert.deepEqual(selection.expected.types.map(type => type.name)
			, ["Witness", "Token", "Marker", "Mark"]);
		assert.deepEqual(zeroPayloadRubyCallerArgs(route), [
			...selection.resultOnly ? ["--result-only"] : []
			, ...selection.reviewed ? ["--reviewed"] : []
		]);
	}
	assert.deepEqual(zeroPayloadRubyEnvironment({}), {
		enabled: false, routes: zeroPayloadRubyRoutes, maxLoad: 12
	});
	assert.deepEqual(zeroPayloadRubyEnvironment({ CI: "true" }), {
		enabled: false, routes: zeroPayloadRubyRoutes, maxLoad: 8
	});
	assert.deepEqual(zeroPayloadRubyEnvironment({
		LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_MAX_LOAD: "8"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 8 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_TEST: "2" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_OUTPUT: "build/out" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_TEST: "1"
			, LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_MODES: "full" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_MAX_LOAD: "7" }
	]) assert.throws(() => zeroPayloadRubyEnvironment(environment));
	assert.throws(() => zeroPayloadRubyConfiguration("missing"));
});

test("zero-payload Ruby carriers preserve empty, UNIT, Option, array and variant identity", () => {
	for(const route of zeroPayloadRubyRoutes)
	{
		const selection = zeroPayloadBrowserSelection(route);
		const files = generateCopiedRubyPackage(selection.expected);
		const publicSource = files[`lib/${zeroPayloadRubyRequirePath}.rb`];
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.equal(manifest.component, "zeropayloadcheckedrecords@1.0.0");
		assert.equal(manifest.namespace, zeroPayloadRubyNamespace);
		assert.equal(manifest.bindingIrSha256.length, 64);
		assert.match(publicSource, /UNIT = ::Object\.new\.freeze/u);
		assert.match(publicSource, /Some = ::Data\.define\(:value\)/u);
		assert.match(publicSource, /class Witness\n\s*\n\s*def initialize\(\)\n\n\s*freeze/u);
		assert.match(publicSource, /class Token\n\s*attr_reader :tag\n\s*def initialize\(tag:\)/u);
		assert.match(publicSource, /class Marker\n\s*\n\s*def initialize\(\)/u);
		assert.match(publicSource, /class Mark\n\s*private_class_method :new/u);
		assert.match(publicSource, /class Mark::Blank < Mark\n\s*public_class_method :new/u);
		assert.match(publicSource, /class Mark::Marked < Mark\n\s*public_class_method :new\n\s*attr_reader :witness/u);
		assert.doesNotMatch(publicSource, /\b(?:positive|fresh)\b/u);
		for(const name of zeroPayloadBrowserResultNames)
			assert.ok(publicSource.includes(`def ${snake(name)}(`), name);
		for(const name of zeroPayloadBrowserInputNames)
			assert.equal(publicSource.includes(`def ${snake(name)}(`), !selection.resultOnly, name);
		if(!selection.resultOnly)
			assert.match(publicSource, /arg0 checked by ZeroPayloadCheckedRecords\.mkAbsent/u);
		const native = files[`lib/${zeroPayloadRubyRequirePath}/native.rb`];
		assert.match(native, /raise TypeError, "Expected Witness" unless exact\?\(value, Witness\)/u);
		assert.match(native, /raise TypeError, "Expected UNIT" unless same\?\(value, UNIT\)/u);
		assert.match(native, /raise TypeError, "Option requires nil or Some\(value\)"/u);
		assert.match(native, /raise TypeError, "Expected an exact Mark constructor"/u);
		assert.match(native, /raise\(status == 1 \? RangeError : LeanBridgeError, message\)/u);
	}
});

test("zero-payload Ruby package identity binds the original gem receipt to its native loader", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }
		, sourceIdentity: { fixture: true } };
	const pkg = { target: "rubygems", ecosystem: "rubygems", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, ...zeroPayloadRubyTarget, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/zeropayloadcheckedrecords-1.0.0-x86_64-linux.gem" }] };
	const receipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-rubygems-package"
		, ecosystem: "rubygems", namespace: zeroPayloadRubyNamespace
		, requirePath: zeroPayloadRubyRequirePath
		, ...zeroPayloadRubyTarget
		, runtimeIdentity: pkg.runtimeIdentity, bindingIrSha256: model.bindingIrSha256
		, component: model.component
		, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion: "2.38"
		, files: { "lib/lean_bridge/zeropayloadcheckedrecords/native/linux-x64/a.so": { sha256: "c".repeat(64) }
			, "lib/lean_bridge/zeropayloadcheckedrecords/native/linux-x64/component.so": { sha256: "d".repeat(64) } } };
	assert.doesNotThrow(() => assertZeroPayloadRubyIdentity(receipt, pkg, model, "2.38"));
	for(const key of ["kind", "namespace", "requirePath", "name", "version", "glibcMinimumVersion"])
		assert.throws(() => assertZeroPayloadRubyIdentity({ ...receipt, [key]: "other" }, pkg, model, "2.38"), key);
	assert.throws(() => assertZeroPayloadRubyIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.38"));
	const runtime = { files: { "lib/a.so": { sha256: "c".repeat(64) } } };
	const component = { runtimeIdentity: sha256(canonicalJson(runtime))
		, bindingIrSha256: model.bindingIrSha256
		, library: "component.so"
		, nativeLibrary: { sha256: "d".repeat(64) } };
	const adapter = { runtimeIdentity: component.runtimeIdentity
		, bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: "a.so", files: { "lib/a.so": { sha256: "c".repeat(64) } } };
	const nativeReceipt = { ...receipt, runtimeIdentity: component.runtimeIdentity };
	assert.deepEqual(zeroPayloadRubyNativeEvidence(nativeReceipt, component, adapter, runtime), {
		runtimeIdentity: component.runtimeIdentity, componentId: "synthetic"
		, componentReceiptSha256: adapter.componentReceiptSha256, library: "a.so"
		, libraries: { "a.so": "c".repeat(64), "component.so": "d".repeat(64) }
	});
	assert.throws(() => zeroPayloadRubyNativeEvidence({ ...nativeReceipt, files: {} }, component, adapter, runtime));
});

test("independent zero-payload Ruby caller refuses faults, preserves rejected inputs and recovers", {
	skip: rubyModelAvailable ? false
		: "Ruby 3.2 or newer is exercised by the installed Ruby workflow"
}, async t => {
	const ruby = rubyCommand();
	const model = "tests/helpers/zero-payload-checked-record-ruby-model.rb";
	const callerPath = "tests/fixtures/zero-payload-checked-record-ruby/ruby.rb";
	const caller = await zeroPayloadRubyCaller();
	assert.match(caller, /Independent Ruby caller/u);
	assert.match(caller, /def check_zero_payload_records\(api/u);
	assert.match(caller, /require "lean_bridge\/zeropayloadcheckedrecords"/u);
	assert.match(caller, /was rejected by ZeroPayloadCheckedRecords\.#\{constructor\}/u);
	for(const probe of [
		'refused.call(:absent_count, [witness_class.new], "mkAbsent"'
		, "host_refused.call(:witness_count, [nil]"
		, "host_refused.call(:witness_count, [marker_class.new]"
		, "host_refused.call(:token_tag, [token_class.new(tag: nil)]"
		, "host_refused.call(:mark_count, [marked_class.new(witness: nil)]"
		, "invoke.call(:maybe_witness, [false], nil)"
		, "invoke.call(:maybe_witness, [true], some_class.new(witness_class.new))"
		, "invoke.call(:witnesses, [0], [])"
		, "invoke.call(:produce_mark, [true], marked_class.new(witness: witness_class.new))"
	]) assert.ok(caller.includes(probe), probe);
	for(const route of zeroPayloadRubyRoutes)
	{
		const mode = route.startsWith("result-only-") ? "result-only" : "full";
		const stdout = execFileSync(ruby, [model, callerPath, ...zeroPayloadRubyCallerArgs(route)]
			, { encoding: "utf8" });
		assert.deepEqual(parseZeroPayloadRubyResult(stdout, mode), zeroPayloadRubyCounts[mode]);
		for(const field of Object.keys(zeroPayloadRubyCounts[mode]))
		{
			const changed = { ...zeroPayloadRubyCounts[mode], [field]: zeroPayloadRubyCounts[mode][field] + 1 };
			assert.throws(() => parseZeroPayloadRubyResult(`${JSON.stringify(changed)}\n`, mode));
		}
		t.diagnostic(`${route}: immutable caller model passed`);
	}
	const faults = JSON.parse(execFileSync(ruby, [model, callerPath, "--faults"], { encoding: "utf8" }));
	assert.deepEqual(faults, {
		full: ["accept-invalid", "wrong-status", "wrong-message", "wrong-produced"
			, "missing-producer", "option-collapsed", "array-length", "host-accepts-nil"]
		, "result-only": ["wrong-produced", "missing-producer", "inputs-exported"
			, "option-collapsed", "array-length"]
	});
	assert.throws(() => parseZeroPayloadRubyResult("{}\n", "full"));
	assert.throws(() => parseZeroPayloadRubyResult("{}", "full"));
	assert.match(await readFile(model, "utf8"), /Independent model/u);
	assert.equal(await zeroPayloadRubyCaller(), caller);
});

test("zero-payload Ruby hosted checker closes each route and its complete TAP stream", () => {
	assert.equal(zeroPayloadRubyReceiptChecksum(Buffer.from("receipt\n"))
		, `${sha256(Buffer.from("receipt\n"))}  package-set-receipt.json\n`);
	const options = {
		route: "ordinary-source", producer: "a".repeat(40), directory: "records"
		, tap: "records/run.tap", glibc: "2.38", ruby: "/opt/ruby/bin/ruby"
	};
	const args = Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]);
	assert.deepEqual(parseZeroPayloadRubyCiArgs(args), options);
	const name = zeroPayloadRubyCiTestName(options.route);
	assert.equal(name, "installed zero-payload records reproduce and relocate in Ruby for ordinary-source");
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
	assertZeroPayloadRubyCiTap(tap, options.route);
	for(const changed of [
		args.slice(2), [...args, "--route", options.route]
		, args.with(1, "ordinary"), args.with(args.indexOf("--ruby") + 1, "ruby")
	]) assert.throws(() => parseZeroPayloadRubyCiArgs(changed));
	for(const changed of [
		tap.replace("# fail 0", "# fail 1"), tap.replace("ok 1", "not ok 1")
		, tap.replace("# skipped 0", "# skipped 1"), tap.replace(name, "other")
	]) assert.throws(() => assertZeroPayloadRubyCiTap(changed, options.route));
});

test("zero-payload Ruby workflow covers every closed route and retains failed records", async () => {
	const workflow = await readFile(".github/workflows/zero-payload-checked-record-ruby.yml", "utf8");
	const runner = await readFile("scripts/run-zero-payload-checked-record-ruby-ci.sh", "utf8");
	const verifyWorkflow = source => {
		assert.ok(source.startsWith("name: Zero-payload checked records in Ruby\n"));
		for(const required of [
			"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
			, "runs-on: ubuntu-24.04", "timeout-minutes: 180", "timeout-minutes: 120"
			, "ruby-version: '3.3.12'", "persist-credentials: false"
			, "bash scripts/run-zero-payload-checked-record-ruby-ci.sh"
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

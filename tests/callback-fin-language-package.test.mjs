/**
 * Source-only rehearsal of the installed callback Fin language lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import {
	callbackFinLanguageTestName, callbackFinLanguageVerification
	, checkCallbackFinLanguageReport, parseCallbackFinLanguageCiArgs
} from "./helpers/callback-fin-language-ci.mjs";
import { callbackFinReviewedIr } from "./helpers/callback-fin-fixture.mjs";

const digest = "a".repeat(64);
const tap = `TAP version 13
# Subtest: ${callbackFinLanguageTestName}
ok 1 - ${callbackFinLanguageTestName}
  ---
  duration_ms: 1
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2
`;
const report = () => ({
	schemaVersion: 1
	, reports: [...["ordinary", "reviewed"].flatMap(route => [
		["python", 19], ["ruby", 19], ["rust", 15]
	].map(([profile, checks]) => ({
		route, profile, checks, bindingIrSha256: digest, consumerSha256: digest
		, receiptSha256: digest, compilerFreePath: true, offlineInstall: true
		, sourceRemovedBeforeInstallation: true
	})))]
});

test("callback Fin language checker closes the hosted six-cell report", () => {
	assert.deepEqual(checkCallbackFinLanguageReport(report()), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["python", "ruby", "rust"], reports: 6
	});
	const checked = callbackFinLanguageVerification("b".repeat(40), tap, report());
	assert.equal(checked.producerCommit, "b".repeat(40));
	assert.equal(checked.kind, "language");
	assert.match(checked.reportSha256, /^[a-f0-9]{64}$/u);
	assert.deepEqual(parseCallbackFinLanguageCiArgs([
		"--producer", "b".repeat(40), "--tap", "run.tap", "--report", "report.json"
	]), { producer: "b".repeat(40), tap: "run.tap", report: "report.json" });
	const missing = report(); missing.reports.pop();
	assert.throws(() => checkCallbackFinLanguageReport(missing));
	const skipped = tap.replace("# skipped 0", "# skipped 1");
	assert.throws(() => callbackFinLanguageVerification("b".repeat(40), skipped, report()));
});

test("callback Fin consumers match generated Python, Ruby and Rust package surfaces", async () => {
	const ir = callbackFinReviewedIr();
	const python = generateCopiedPythonPackage(ir);
	const ruby = generateCopiedRubyPackage(ir);
	const rust = generateCopiedRustPackage(ir, null, {
		name: "reviewedcallbacks", version: "1.0.0"
	});
	assert.deepEqual(Object.keys(python).sort(), [
		"README.md", "binding-manifest.json"
		, "lean_reviewedcallbacks/__init__.py"
		, "lean_reviewedcallbacks/__init__.pyi"
		, "lean_reviewedcallbacks/_native.py"
		, "lean_reviewedcallbacks/py.typed"
	].sort());
	assert.ok(Object.hasOwn(ruby, "lib/lean_bridge/reviewedcallbacks.rb"));
	assert.ok(Object.hasOwn(rust, "src/lib.rs"));
	const packageSources = [python["lean_reviewedcallbacks/__init__.py"]
		, ruby["lib/lean_bridge/reviewedcallbacks.rb"], rust["src/lib.rs"]];
	for(const source of packageSources)
	{
		for(const token of ["scaler", "counter", "visit"
			, "digits", "tiles", "tile_maker", "apply"])
			assert.ok(source.includes(token), token);
		assert.ok(!source.includes("with_recovery"));
	}
	const consumers = {
		python: await readFile("tests/fixtures/callback-fin-consumers/python.py", "utf8")
		, ruby: await readFile("tests/fixtures/callback-fin-consumers/ruby.rb", "utf8")
		, rust: await readFile("tests/fixtures/callback-fin-consumers/rust.rs", "utf8")
	};
	assert.match(consumers.python, /import lean_reviewedcallbacks as api/u);
	assert.match(consumers.ruby, /require "lean_bridge\/reviewedcallbacks"/u);
	for(const message of [
		"arg0 is not below its Fin 10 bound"
		, "arg0[0] is not below its Fin 3 bound"
		, "arg0[0].digit is not below its Fin 5 bound"
	]) assert.ok(consumers.ruby.includes(message), message);
	assert.equal(consumers.ruby.match(/reject\(RangeError\)/gu)?.length, 3);
	assert.doesNotMatch(consumers.ruby, /reject\(API::LeanBridgeError\)/u);
	assert.match(consumers.rust, /use reviewedcallbacks as api;/u);
	for(const source of Object.values(consumers))
	{
		assert.match(source, /callback-fin-language-ok/u);
		assert.doesNotMatch(source, /with_recovery/u);
	}
});

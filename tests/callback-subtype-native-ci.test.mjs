/**
 * Contract tests for installed C/C++ and Perl callback Subtype CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	callbackSubtypeNativeTestName
	, callbackSubtypeNativeVerification
	, callbackSubtypeLanguageTestName
	, callbackSubtypePerlTestName
	, checkCallbackSubtypeLanguageReport
	, checkCallbackSubtypeNativeReport
	, checkCallbackSubtypePerlReport
	, parseCallbackSubtypeNativeCiArgs
} from "./helpers/callback-subtype-native-ci.mjs";

const sha = character => character.repeat(64);
const tap = name => `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;

const nativeReport = () => {
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const [index, profile] of ["c", "cpp"].entries())
			reports.push({
				bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
				, checks: profile === "c" ? 16 : 13
				, compilerFreePath: true
				, consumerSha256: sha(String(index + 1))
				, offlineInstall: true
				, profile
				, receiptSha256: sha(route === "ordinary" ? "c" : "d")
				, route
				, sourceRemovedBeforeInstallation: true
			});
	return { schemaVersion: 1, reports };
};

const perlReport = () => {
	const installedFiles = {};
	for(let index = 0; index < 11; index++)
		installedFiles[`file-${index}`] = {
			bytes: index, sha256: sha((index % 10).toString())
		};
	const packages = ["component", "runtime"].map((role, index) => ({
		role
		, artifacts: [{
			bytes: index + 1
			, sha256: sha(String(index + 1))
			, path: `archives/${role}.tar.gz`
		}]
	}));
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const mode of ["prebuilt-only", "build-xs"])
			for(let index = 0; index < 4; index++)
				reports.push({
					bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
					, calls: 5
					, checks: 34
					, handoffRemovedBeforeExecution: true
					, hostVersion: index < 2 ? "v5.36.3" : "v5.38.2"
					, installedFiles
					, mode
					, packages
					, perlSha256: sha(String(index + 1))
					, rejected: 6
					, relocated: true
					, repeated: true
					, route
					, schemaVersion: 1
					, sourceRemovedBeforeInstallation: true
				});
	return { schemaVersion: 1, reports };
};

const languageReport = () => {
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const [index, profile] of ["python", "ruby", "rust"].entries())
			reports.push({
				bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
				, checks: profile === "rust" ? 17 : 15
				, compilerFreePath: true
				, consumerSha256: sha(String(index + 1))
				, offlineInstall: true
				, profile
				, receiptSha256: sha(route === "ordinary" ? "c" : "d")
				, route
				, sourceRemovedBeforeInstallation: true
			});
	return { schemaVersion: 1, reports };
};

test("callback Subtype CI checkers require the closed native and Perl matrices", () => {
	const native = nativeReport(), perl = perlReport(), language = languageReport();
	assert.deepEqual(checkCallbackSubtypeNativeReport(native), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["c", "cpp"]
		, reports: 4
	});
	assert.deepEqual(checkCallbackSubtypePerlReport(perl), {
		routes: ["ordinary", "reviewed"]
		, modes: ["prebuilt-only", "build-xs"]
		, interpreterCount: 4
		, reports: 16
	});
	assert.deepEqual(checkCallbackSubtypeLanguageReport(language), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["python", "ruby", "rust"]
		, reports: 6
	});
	const commit = "e".repeat(40);
	assert.equal(callbackSubtypeNativeVerification("native", commit
		, tap(callbackSubtypeNativeTestName), native).reports, 4);
	assert.equal(callbackSubtypeNativeVerification("perl", commit
		, tap(callbackSubtypePerlTestName), perl).reports, 16);
	assert.equal(callbackSubtypeNativeVerification("language", commit
		, tap(callbackSubtypeLanguageTestName), language).reports, 6);
	const changed = structuredClone(perl); changed.reports[0].rejected = 5;
	assert.throws(() => checkCallbackSubtypePerlReport(changed));
	assert.throws(() => callbackSubtypeNativeVerification("native", commit
		, tap(callbackSubtypeNativeTestName).replace("# pass 1", "# pass 0")
		, native));
	assert.deepEqual(parseCallbackSubtypeNativeCiArgs([
		"--producer", commit, "--tap", "run.tap", "--report", "report.json"
	]), { producer: commit, tap: "run.tap", report: "report.json" });
	assert.throws(() => parseCallbackSubtypeNativeCiArgs([
		"--producer", commit, "--tap", "run.tap", "--tap", "again.tap"
	]));
});

test("callback Subtype native workflows preserve failures and cannot narrow the matrix", async () => {
	const nativeWorkflow = await readFile(
		".github/workflows/callback-subtype-native.yml", "utf8"
	);
	const perlWorkflow = await readFile(
		".github/workflows/callback-subtype-perl.yml", "utf8"
	);
	const languageWorkflow = await readFile(
		".github/workflows/callback-subtype-languages.yml", "utf8"
	);
	const workflows = [
		[nativeWorkflow, [
			"group: callback-subtype-native-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "bash scripts/run-callback-subtype-native-ci.sh"
			, "build/callback-subtype-native-ci/"
		]]
		, [perlWorkflow, [
			"group: callback-subtype-perl-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "5.36.3 threaded"
			, "5.36.3 unthreaded"
			, "5.38.2 threaded"
			, "5.38.2 unthreaded"
			, "bash scripts/run-callback-subtype-perl-ci.sh"
			, "build/callback-subtype-perl-ci/"
		]]
		, [languageWorkflow, [
			"group: callback-subtype-languages-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "ruby-version: '3.3.12'"
			, 'python-version: "3.12"'
			, "bash scripts/bootstrap-rust-ci.sh"
			, "bash scripts/run-callback-subtype-languages-ci.sh"
			, "build/callback-subtype-languages-ci/"
		]]
	];
	for(const [source, required] of workflows)
	{
		for(const value of [
			"push:"
			, "pull_request:"
			, "workflow_dispatch:"
			, "persist-credentials: false"
			, "if: always()"
			, "if-no-files-found: error"
			, "steps.acceptance.outcome != 'success'"
			, "run: exit 1"
			, ...required
		]) assert.ok(source.includes(value), value);
		assert.doesNotMatch(source, /continue-on-error:|strategy:|needs:/u);
	}
	const nativeShell = await readFile(
		"scripts/run-callback-subtype-native-ci.sh", "utf8"
	);
	const perlShell = await readFile(
		"scripts/run-callback-subtype-perl-ci.sh", "utf8"
	);
	const languageShell = await readFile(
		"scripts/run-callback-subtype-languages-ci.sh", "utf8"
	);
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES=c,cpp"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-native-ci.mjs"
	]) assert.ok(nativeShell.includes(value), value);
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_PERL_TEST=1"
		, "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-perl-ci.mjs"
	]) assert.ok(perlShell.includes(value), value);
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_SUBTYPE_LANGUAGE_PROFILES=python,ruby,rust"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, "check-callback-subtype-languages-ci.mjs"
	]) assert.ok(languageShell.includes(value), value);
});

/**
 * Contract tests for installed C/C++ and Perl callback checked-record CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	callbackCheckedRecordLanguageChecks
	, callbackCheckedRecordLanguageTestName
	, callbackCheckedRecordNativeChecks
	, callbackCheckedRecordNativeTestName
	, callbackCheckedRecordNativeVerification
	, callbackCheckedRecordPerlExpected
	, callbackCheckedRecordPerlTestName
	, checkCallbackCheckedRecordLanguageReport
	, checkCallbackCheckedRecordNativeReport
	, checkCallbackCheckedRecordPerlReport
	, parseCallbackCheckedRecordNativeCiArgs
} from "./helpers/callback-checked-record-native-ci.mjs";
import {
	callbackCheckedRecordRemainingChecks
	, callbackCheckedRecordRemainingTestName
	, callbackCheckedRecordRemainingVerification
	, checkCallbackCheckedRecordRemainingReport
	, parseCallbackCheckedRecordRemainingCiArgs
} from "./helpers/callback-checked-record-remaining-ci.mjs";

const sha = character => character.repeat(64);
const tap = name => `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;

const nativeReport = () => {
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const [index, profile] of ["c", "cpp"].entries())
			reports.push({
				bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
				, checks: callbackCheckedRecordNativeChecks[profile]
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
					, ...callbackCheckedRecordPerlExpected
					, handoffRemovedBeforeExecution: true
					, hostVersion: index < 2 ? "v5.36.3" : "v5.38.2"
					, installedFiles
					, mode
					, packages
					, perlSha256: sha(String(index + 1))
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
				, checks: callbackCheckedRecordLanguageChecks[profile]
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

const remainingReport = selectedProfiles => {
	const reports = [];
	for(const route of ["ordinary", "reviewed"])
		for(const [index, profile] of selectedProfiles.entries())
		{
			const item = {
				bindingIrSha256: sha(route === "ordinary" ? "a" : "b")
				, checks: callbackCheckedRecordRemainingChecks[profile]
				, compilerFreePath: true
				, consumerSha256: sha(String(index + 1))
				, offlineInstall: true, profile
				, receiptSha256: sha(route === "ordinary" ? "c" : "d")
				, route, sourceRemovedBeforeInstallation: true
			};
			if(profile === "dotnet") Object.assign(item, {
				installedAssemblySha256: sha("e"), repeatExecution: true
				, runtimeVersion: "8.0.24", sdkFreeRuntime: true, sourceFreeExecution: true
			});
			if(["java", "kotlin"].includes(profile)) Object.assign(item, {
				componentSha256: sha("e"), dependencyClosureSha256: sha("f")
				, offlineMaven: true, repeatExecution: true, runtimeOnly: true
			});
			if(profile === "php-native") Object.assign(item, {
				closedComposerInstall: true, packageFileSetSha256: sha("e")
				, relocatedReplay: true, repeatExecution: true, vendorFilesSha256: sha("f")
			});
			if(profile === "wit-wasi") Object.assign(item, {
				handoffRemovedBeforeReplay: true, libraryClosureSha256: sha("e")
				, packageFileSetSha256: sha("f"), relocatedReplay: true
				, repeatExecution: true, runtimeOnly: true, sourceFreeExecution: true
			});
			reports.push(item);
		}
	return { schemaVersion: 1, reports };
};

test("callback checked-record consumers pin their success-path counts", async () => {
	const count = async name => (await readFile(`tests/fixtures/callback-checked-record-consumers/${name}`, "utf8"))
		.split("\n").filter(line => !/^\s*#define\s+CHECK\b/u.test(line))
		.reduce((total, line) => total + (line.match(/\bCHECK\(/gu)?.length ?? 0), 0);
	assert.equal(await count("c.c"), callbackCheckedRecordNativeChecks.c);
	assert.equal(await count("cpp.cpp"), callbackCheckedRecordNativeChecks.cpp);
	const perl = await readFile("tests/fixtures/callback-checked-record-consumers/perl.pl", "utf8");
	const exports = ["call_host", "make_closure"
		, "call_host_mixed", "make_mixed_closure"
		, "call_host_container", "make_container_closure"
		, "call_host_nested", "make_nested_closure"];
	for(const name of exports) assert.ok(perl.includes(`'${name}'`), name);
	assert.match(perl, /Runtime::Callback->new\(/u);
	assert.match(perl, /checks => \$checks, calls => \$calls, rejected => \$rejected/u);
});

test("callback checked-record CI checkers require the closed native and language matrices", () => {
	const native = nativeReport(), perl = perlReport(), languages = languageReport();
	assert.deepEqual(checkCallbackCheckedRecordNativeReport(native), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["c", "cpp"]
		, reports: 4
	});
	assert.deepEqual(checkCallbackCheckedRecordPerlReport(perl), {
		routes: ["ordinary", "reviewed"]
		, modes: ["prebuilt-only", "build-xs"]
		, interpreterCount: 4
		, reports: 16
	});
	assert.deepEqual(checkCallbackCheckedRecordLanguageReport(languages), {
		routes: ["ordinary", "reviewed"]
		, profiles: ["python", "ruby", "rust"]
		, reports: 6
	});
	const commit = "e".repeat(40);
	assert.equal(callbackCheckedRecordNativeVerification("native", commit
		, tap(callbackCheckedRecordNativeTestName), native).reports, 4);
	assert.equal(callbackCheckedRecordNativeVerification("perl", commit
		, tap(callbackCheckedRecordPerlTestName), perl).reports, 16);
	assert.equal(callbackCheckedRecordNativeVerification("language", commit
		, tap(callbackCheckedRecordLanguageTestName), languages).reports, 6);
	for(const mutate of [
		value => { value.reports[0].rejected -= 1; }
		, value => { value.reports[0].calls += 1; }
		, value => { value.reports[0].checks = 34; }
		, value => { value.reports.pop(); }
		, value => { value.reports[1].perlSha256 = value.reports[0].perlSha256; }
	]) {
		const changed = structuredClone(perl); mutate(changed);
		assert.throws(() => checkCallbackCheckedRecordPerlReport(changed));
	}
	for(const mutate of [
		value => { value.reports[0].checks = 16; }
		, value => { value.reports[1].checks = 13; }
		, value => { value.reports[0].compilerFreePath = false; }
		, value => { value.reports[3].route = "ordinary"; }
	]) {
		const changed = structuredClone(native); mutate(changed);
		assert.throws(() => checkCallbackCheckedRecordNativeReport(changed));
	}
	for(const mutate of [
		value => { value.reports[0].checks -= 1; }
		, value => { value.reports[1].profile = "python"; }
		, value => { value.reports[2].offlineInstall = false; }
		, value => { value.reports.pop(); }
	]) {
		const changed = structuredClone(languages); mutate(changed);
		assert.throws(() => checkCallbackCheckedRecordLanguageReport(changed));
	}
	assert.throws(() => callbackCheckedRecordNativeVerification("native", commit
		, tap(callbackCheckedRecordNativeTestName).replace("# pass 1", "# pass 0"), native));
	assert.throws(() => callbackCheckedRecordNativeVerification("native", commit
		, tap(callbackCheckedRecordPerlTestName), native));
	assert.throws(() => callbackCheckedRecordNativeVerification("unknown", commit
		, tap(callbackCheckedRecordNativeTestName), native));
	assert.deepEqual(parseCallbackCheckedRecordNativeCiArgs([
		"--producer", commit, "--tap", "run.tap", "--report", "report.json"
	]), { producer: commit, tap: "run.tap", report: "report.json" });
	assert.throws(() => parseCallbackCheckedRecordNativeCiArgs([
		"--producer", commit, "--tap", "run.tap", "--tap", "again.tap"
	]));
	assert.throws(() => parseCallbackCheckedRecordNativeCiArgs([
		"--producer", "abc", "--tap", "run.tap", "--report", "report.json"
	]));
});

test("remaining callback checked-record checker requires exact route and host evidence", () => {
	const profiles = ["dotnet", "java", "kotlin", "php-native", "wit-wasi"];
	const report = remainingReport(profiles), commit = "e".repeat(40);
	assert.deepEqual(checkCallbackCheckedRecordRemainingReport(report, profiles), {
		profiles, routes: ["ordinary", "reviewed"], reports: 10
	});
	assert.equal(callbackCheckedRecordRemainingVerification(commit, profiles
		, tap(callbackCheckedRecordRemainingTestName), report).reports, 10);
	assert.deepEqual(parseCallbackCheckedRecordRemainingCiArgs([
		"--producer", commit, "--profiles", "java,kotlin"
		, "--tap", "run.tap", "--report", "report.json"
	]), {
		producer: commit, profiles: ["java", "kotlin"]
		, tap: "run.tap", report: "report.json"
	});
	for(const mutate of [
		value => { value.reports[0].checks -= 1; }
		, value => { value.reports[2].runtimeOnly = false; }
		, value => { value.reports[3].closedComposerInstall = false; }
		, value => { value.reports[4].sourceFreeExecution = false; }
		, value => { value.reports.pop(); }
	]) {
		const changed = structuredClone(report); mutate(changed);
		assert.throws(() => checkCallbackCheckedRecordRemainingReport(changed, profiles));
	}
	assert.throws(() => parseCallbackCheckedRecordRemainingCiArgs([
		"--producer", commit, "--profiles", "java,java"
		, "--tap", "run.tap", "--report", "report.json"
	]));
});

test("callback checked-record native workflows preserve failures and cannot narrow the matrix", async () => {
	const nativeWorkflow = await readFile(".github/workflows/callback-checked-record-native.yml", "utf8");
	const perlWorkflow = await readFile(".github/workflows/callback-checked-record-perl.yml", "utf8");
	const languageWorkflow = await readFile(".github/workflows/callback-checked-record-languages.yml", "utf8");
	const remainingWorkflow = await readFile(".github/workflows/callback-checked-record-remaining.yml", "utf8");
	const workflows = [
		[nativeWorkflow, [
			"group: callback-checked-record-native-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "bash scripts/run-callback-checked-record-native-ci.sh"
			, "build/callback-checked-record-native-ci/"
		]]
		, [perlWorkflow, [
			"group: callback-checked-record-perl-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "5.36.3 threaded"
			, "5.36.3 unthreaded"
			, "5.38.2 threaded"
			, "5.38.2 unthreaded"
			, "bash scripts/run-callback-checked-record-perl-ci.sh"
			, "build/callback-checked-record-perl-ci/"
		]]
		, [languageWorkflow, [
			"group: callback-checked-record-languages-${{ github.ref }}"
			, "runs-on: ubuntu-24.04"
			, "ruby-version: '3.3.12'"
			, 'python-version: "3.12"'
			, "bash scripts/bootstrap-rust-ci.sh"
			, "bash scripts/run-callback-checked-record-languages-ci.sh"
			, "build/callback-checked-record-languages-ci/"
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
	const nativeShell = await readFile("scripts/run-callback-checked-record-native-ci.sh", "utf8");
	const perlShell = await readFile("scripts/run-callback-checked-record-perl-ci.sh", "utf8");
	const languageShell = await readFile("scripts/run-callback-checked-record-languages-ci.sh", "utf8");
	const remainingShell = await readFile("scripts/run-callback-checked-record-remaining-ci.sh", "utf8");
	const remainingChecker = await readFile("scripts/check-callback-checked-record-remaining-ci.mjs", "utf8");
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_NATIVE_PROFILES=c,cpp"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, `--test-name-pattern="^$name$"`
		, "check-callback-checked-record-native-ci.mjs"
	]) assert.ok(nativeShell.includes(value), value);
	assert.ok(nativeShell.includes(`name='${callbackCheckedRecordNativeTestName}'`));
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_PERL_TEST=1"
		, "LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, `--test-name-pattern="^$name$"`
		, "check-callback-checked-record-perl-ci.mjs"
	]) assert.ok(perlShell.includes(value), value);
	assert.ok(perlShell.includes(`name='${callbackCheckedRecordPerlTestName}'`));
	for(const value of [
		"set -euo pipefail"
		, "LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_LANGUAGE_PROFILES=python,ruby,rust"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "--test-concurrency=1"
		, `--test-name-pattern="^$name$"`
		, "check-callback-checked-record-languages-ci.mjs"
	]) assert.ok(languageShell.includes(value), value);
	assert.ok(languageShell.includes(`name='${callbackCheckedRecordLanguageTestName}'`));
	for(const value of [
		"group: callback-checked-record-remaining-${{ github.ref }}"
		, "lane: [dotnet, jvm, php-native, wit-wasi]"
		, "runs-on: ubuntu-24.04"
		, "bash scripts/run-callback-checked-record-remaining-ci.sh"
		, "build/callback-checked-record-remaining-ci-${{ matrix.lane }}/"
		, "if: always()", "steps.acceptance.outcome != 'success'"
	]) assert.ok(remainingWorkflow.includes(value), value);
	for(const value of [
		"set -euo pipefail", "profiles=dotnet", "profiles=java,kotlin"
		, "profiles=php-native", "profiles=wit-wasi"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38", "--test-concurrency=1"
		, "check-callback-checked-record-remaining-ci.mjs"
	]) assert.ok(remainingShell.includes(value), value);
	assert.ok(remainingShell.includes(`name='${callbackCheckedRecordRemainingTestName}'`));
	for(const value of [
		"callbackCheckedRecordRemainingVerification"
		, "parseCallbackCheckedRecordRemainingCiArgs"
	]) assert.ok(remainingChecker.includes(value), value);
	for(const shell of [nativeShell, perlShell, languageShell, remainingShell])
	{
		assert.match(shell, /if \[\[ -v \$name \]\]; then/u);
		assert.match(shell, /test "\$\(git rev-parse HEAD\)" = "\$revision"/u);
		assert.doesNotMatch(shell, /\|\| true|set \+e/u);
	}
});

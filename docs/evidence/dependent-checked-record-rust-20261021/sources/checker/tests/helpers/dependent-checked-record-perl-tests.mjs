/**
 * Static contract tests for dependent checked-record Perl acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertDependentCheckedRecordPerlCiTap
	, dependentCheckedRecordPerlCiTestName
	, dependentCheckedRecordPerlRecordPaths
	, parseDependentCheckedRecordPerlCiArgs
} from "./dependent-checked-record-perl-ci-report.mjs";
import {
	dependentCheckedRecordPerlCaller
	, dependentCheckedRecordPerlConfigurations
	, dependentCheckedRecordPerlExpected
	, dependentCheckedRecordPerlInstallModes
	, dependentCheckedRecordPerlRoutes
	, dependentCheckedRecordPerlSelection
	, parseDependentCheckedRecordPerlResult
} from "./dependent-checked-record-perl-fixture.mjs";

test("dependent Perl selections close four routes and every ABI mode", async () => {
	assert.deepEqual(dependentCheckedRecordPerlRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(dependentCheckedRecordPerlConfigurations, [
		"5.36.3-threaded", "5.36.3-unthreaded"
		, "5.38.2-threaded", "5.38.2-unthreaded"
	]);
	assert.deepEqual(dependentCheckedRecordPerlInstallModes
		, ["prebuilt-only", "build-xs"]);
	for(const route of dependentCheckedRecordPerlRoutes)
	{
		const selection = dependentCheckedRecordPerlSelection(route);
		assert.deepEqual(Object.keys(selection.configuration.targets), ["cpan"]);
		assert.deepEqual(parseDependentCheckedRecordPerlResult(
			`${JSON.stringify(dependentCheckedRecordPerlExpected(route))}\n`
			, route), dependentCheckedRecordPerlExpected(route));
		const paths = dependentCheckedRecordPerlRecordPaths(route);
		assert.equal(paths.length, new Set(paths).size);
		assert.ok(paths.includes("build-0/DependentRecords.lean"));
	}
	const caller = await dependentCheckedRecordPerlCaller();
	assert.match(caller, /Math::BigInt/u);
	assert.match(caller, /DependentRecords\.mkDependent/u);
	assert.doesNotMatch(caller, /->valid\b/u);
	const syntax = spawnSync("/usr/bin/perl", ["-c", "-"], {
		input: caller, encoding: "utf8"
	});
	assert.equal(syntax.status, 0, syntax.stdout + syntax.stderr);
	assert.match(syntax.stderr, /syntax OK/u);
});

test("dependent Perl installed gate refuses substituted selections", () => {
	const base = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith(
			"LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_"
		) && key !== "NODE_TEST_CONTEXT"));
	const run = changes => spawnSync(process.execPath, [
		"--test", "--test-reporter=tap"
		, "tests/helpers/dependent-checked-record-perl-installed-tests.mjs"
	], { env: { ...base, ...changes }, encoding: "utf8", timeout: 15_000 });
	const disabled = run({ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST: "0" });
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST: "0"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_ROUTES:
				"ordinary-source,ordinary-source" }
	]) {
		const result = run(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /dependent checked-record Perl author/u);
	}
});

test("dependent Perl checker binds one exact original TAP route", () => {
	const route = "reviewed-ir";
	const title = dependentCheckedRecordPerlCiTestName(route);
	const tap = `TAP version 13\n# Subtest: ${title}\nok 1 - ${title}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
	assert.doesNotThrow(() => assertDependentCheckedRecordPerlCiTap(tap, route));
	assert.throws(() => assertDependentCheckedRecordPerlCiTap(
		tap.replace("# skipped 0", "# skipped 1"), route));
	assert.deepEqual(parseDependentCheckedRecordPerlCiArgs([
		"--route", route, "--producer", "a".repeat(40)
		, "--directory", "records", "--tap", "run.tap"
		, "--glibc", "2.38", "--max-load", "8"
	]), {
		route, producer: "a".repeat(40), directory: "records", tap: "run.tap"
		, glibc: "2.38", maxLoad: 8
	});
});

test("dependent Perl hosted gate preserves every complete route", async () => {
	const workflow = await readFile(
		".github/workflows/dependent-checked-record-perl.yml", "utf8"
	);
	const runner = await readFile(
		"scripts/run-dependent-checked-record-perl-ci.sh", "utf8"
	);
	for(const required of [
		"runs-on: ubuntu-24.04", "timeout-minutes: 240"
		, "bash scripts/run-dependent-checked-record-perl-ci.sh"
		, "if: always() && steps.acceptance.outcome != 'success'"
		, "retention-days: 30"
	]) assert.ok(workflow.includes(required), required);
	for(const route of dependentCheckedRecordPerlRoutes)
		assert.ok(runner.includes(route), route);
	for(const required of [
		"LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST=1"
		, "--test-concurrency=1"
		, "check-dependent-checked-record-perl-ci.mjs"
	]) assert.ok(runner.includes(required), required);
});

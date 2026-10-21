/**
 * Static contract tests for dependent checked-record C/C++ acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import {
	dependentCheckedRecordNativeCaller
	, dependentCheckedRecordNativeProfiles
	, dependentCheckedRecordNativeRoutes
	, dependentCheckedRecordNativeSelection
} from "./dependent-checked-record-native-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("dependent native selections cover four routes and both profiles", async () => {
	assert.deepEqual(dependentCheckedRecordNativeProfiles, ["c", "cpp"]);
	assert.deepEqual(dependentCheckedRecordNativeRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	for(const route of dependentCheckedRecordNativeRoutes)
	{
		const selection = dependentCheckedRecordNativeSelection(route);
		assert.deepEqual(Object.keys(selection.configuration.targets).sort()
			, dependentCheckedRecordNativeProfiles);
		for(const profile of dependentCheckedRecordNativeProfiles)
		{
			const caller = await dependentCheckedRecordNativeCaller(profile, route);
			assert.equal(caller.checks, selection.resultOnly ? 513 : 521);
			assert.match(caller.source, /dependent-checked-record-ok/u);
			assert.match(caller.source, selection.resultOnly
				? /dependent_result/u : /dependent_total/u);
			assert.doesNotMatch(caller.source, /[.>]valid/u);
		}
	}
});

test("independent dependent-record callers compile against generated headers", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-native-callers-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const resultOnly of [false, true])
		for(const profile of dependentCheckedRecordNativeProfiles)
		{
			const route = resultOnly
				? "result-only-reviewed-ir" : "reviewed-ir";
			const review = dependentCheckedRecordNativeSelection(route).expected;
			const directory = join(root, `${profile}-${resultOnly}`);
			const files = {
				...generateCBindingPackage(review)
				, ...profile === "c" ? generateGmpProjection(review).files : {
					...generateCppBindingPackage(review), ...boostSources()
				}
			};
			for(const [path, source] of Object.entries(files))
				await saveLakeFile(directory, path, source);
			const caller = await dependentCheckedRecordNativeCaller(profile, route);
			await saveLakeFile(directory, `consumer.${profile}`, caller.source);
			await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", [
				`-std=${profile === "c" ? "c11" : "c++20"}`
				, "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude"
				, `consumer.${profile}`
			], directory);
		}
});

test("dependent native installed gates refuse malformed selections", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-native-gate-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const base = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("LEAN_BRIDGE_")
			&& key !== "NODE_TEST_CONTEXT"));
	const flags = {
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_TEST: "0"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_OUTPUT: directory
	};
	const run = changes => spawnSync(process.execPath, [
		"--test", "--test-reporter=tap"
		, "tests/helpers/dependent-checked-record-native-installed-tests.mjs"
	], { env: { ...base, ...flags, ...changes }, encoding: "utf8", timeout: 15_000 });
	const disabled = run({});
	assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
	assert.match(disabled.stdout, /# skipped 4/u);
	for(const changes of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_ROUTES: "" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_ROUTES:
			"ordinary-source,ordinary-source" }
	]) {
		const result = run(changes);
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.doesNotMatch(result.stdout, /dependent native author/u);
	}
});

test("dependent native CI preserves each complete route", async () => {
	const workflow = await readFile(
		".github/workflows/dependent-checked-record-native.yml", "utf8"
	);
	const runner = await readFile(
		"scripts/run-dependent-checked-record-native-ci.sh", "utf8"
	);
	for(const required of [
		"runs-on: ubuntu-24.04", "timeout-minutes: 240"
		, "bash scripts/run-dependent-checked-record-native-ci.sh"
		, "if: always() && steps.acceptance.outcome != 'success'"
		, "retention-days: 30"
	]) assert.ok(workflow.includes(required), required);
	for(const route of dependentCheckedRecordNativeRoutes)
		assert.ok(runner.includes(route), route);
	for(const required of [
		"LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_TEST=1"
		, "--test-concurrency=1", 'test -s "$records/$route/report.json"'
	]) assert.ok(runner.includes(required), required);
});

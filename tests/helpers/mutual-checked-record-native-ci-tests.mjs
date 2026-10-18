/**
 * Fail-closed controls for recursive checked-record C/C++ hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertMutualCheckedRecordNativeCiTap
	, parseMutualCheckedRecordNativeCiArgs
} from "./mutual-checked-record-native-ci-report.mjs";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordRefinements
	, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";
import {
	mutualCheckedRecordNativeFixture
	, mutualCheckedRecordNativeGeneratedSources
} from "./mutual-checked-record-native-report.mjs";
import {
	nominalPrimitiveSubtypeNativeGenerators
} from "./nominal-primitive-subtype-native-generators.mjs";
import {
	assertMutualCheckedRecordNativeWorkflow
} from "./mutual-checked-record-native-ci-workflow.mjs";

test("recursive checked-record native workflow requires both C/C++ routes", async t => {
	const source = await readFile(
		".github/workflows/recursive-checked-record-native.yml", "utf8");
	assertMutualCheckedRecordNativeWorkflow(source);
	const changes = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["    runs-on: ubuntu-24.04", "    runs-on: ubuntu-latest"]
		, ["    timeout-minutes: 180", "    timeout-minutes: 20"]
		, ["    env:\n", "    continue-on-error: true\n    env:\n"]
		, ['      LEAN_NUM_THREADS: "1"', '      LEAN_NUM_THREADS: "8"']
		, ["          fetch-depth: 0", "          fetch-depth: 1"]
		, ['          node-version: "22"', '          node-version: "24"']
		, ["        timeout-minutes: 120", "        timeout-minutes: 1"]
		, ["          source scripts/env.sh\n", ""]
		, ["bash scripts/run-mutual-checked-record-native-ci.sh"
			, "bash scripts/run-mutual-checked-record-native-ci.sh || true"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only"
			, "bash scripts/bootstrap-toolchains.sh"]
		, ["        if: always()\n", "        if: success()\n"]
		, ["          if-no-files-found: error", "          if-no-files-found: warn"]
		, ["            build/mutual-checked-record-native-ci/"
			, "            build/mutual-checked-record-native-ci/ordinary/"]
		, ["          retention-days: 30", "          retention-days: 1"]
		, ["        if: always() && steps.acceptance.outcome != 'success'"
			, "        if: failure()"]
		, ["        run: exit 1", "        run: exit 0"]
	];
	for(const [before, after] of changes)
	{
		assert.ok(source.includes(before), before);
		assert.throws(() => assertMutualCheckedRecordNativeWorkflow(
			source.replace(before, after)), undefined, before);
	}
	t.diagnostic(`${changes.length} workflow bypass controls.`);
});

test("recursive checked-record native shell fixes both routes and exact checker", async () => {
	const source = await readFile("scripts/run-mutual-checked-record-native-ci.sh"
		, "utf8");
	assert.ok(source.startsWith("#!/usr/bin/env bash\n"));
	assert.match(source, /set -euo pipefail/u);
	assert.match(source, /for route in ordinary reviewed; do/u);
	assert.match(source, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.38/u);
	assert.match(source, /LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_TEST=1/u);
	assert.match(source, /--test-concurrency=1/u);
	assert.ok(source.includes('--test-name-pattern="^${name//+/\\\\+}$"'));
	assert.match(source, /check-mutual-checked-record-native-ci\.mjs/u);
	assert.match(source, /--producer "\$revision"/u);
	assert.match(source, /--floor "\$LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"/u);
	assert.match(source, /2>&1 \| tee "\$output\/run\.tap"/u);
	assert.doesNotMatch(source, /\|\| true|continue-on-error|--test-only/u);
	const name = "installed mutual checked-record C/C++ packages reproduce and relocate ordinary";
	const pattern = execFileSync("bash", ["-c"
		, 'name="$1"; printf "%s" "^${name//+/\\\\+}$"', "bash", name]
	, { encoding: "utf8" });
	const selector = new RegExp(pattern);
	assert.equal(selector.test(name), true);
	assert.equal(selector.test(name.replace("ordinary", "reviewed")), false);
});

test("recursive checked-record native verifier selects graph package sources", async () => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	const generators = await nominalPrimitiveSubtypeNativeGenerators(
		producerCommit);
	const bindingIr = mutualCheckedRecordReview();
	assert.throws(() => generators.generateCBindingPackage(bindingIr)
		, { code: "unsupported-array-element" });
	const graph = generators.generateCopiedGraphPackage(
		bindingIr, ["c", "cpp"], { refinementDiagnostics: true });
	assert.equal(graph.bigint, true);
	for(const path of [
		"gmp/include/mutualcheckedrecords.h"
		, "include/mutualcheckedrecords.hpp"
	]) assert.equal(typeof graph.files[path], "string", path);
	const calls = [];
	const sources = profile => mutualCheckedRecordNativeGeneratedSources({
		generators: {
			generateCopiedGraphPackage: (actualIr, targets, options) => {
				calls.push(["graph", actualIr, targets, options]);
				return {
					targets
					, bigint: true
					, files: {
						"gmp/include/c-public.h": "c"
						, "include/cpp-public.hpp": "cpp"
						, "src/cpp.cpp": "cpp-source"
					}
				};
			}
			, nativeGraphProjectionSources: (actualModel, receipt) => {
				calls.push(["projection", actualModel, receipt]);
				return { "include/detail/graph.h": "graph", "src/native.c": "native" };
			}
			, nativeGraphRefinementDiagnostics: actualModel => {
				calls.push(["diagnostics", actualModel]); return true;
			}
			, boostSources: () => {
				calls.push(["boost"]);
				return { "include/boost/value.hpp": "boost" };
			}
		}
		, model: { bindingIr }, nativeComponent: { initializer: "initialize" }
		, targets: ["c", "cpp"], profile
	});
	assert.deepEqual(sources("c").package, { "include/c-public.h": "c" });
	assert.deepEqual(sources("cpp").package, {
		"gmp/include/c-public.h": "c"
		, "include/cpp-public.hpp": "cpp", "src/cpp.cpp": "cpp-source"
		, "include/detail/graph.h": "graph", "src/native.c": "native"
		, "include/boost/value.hpp": "boost"
	});
	assert.deepEqual(calls.map(call => call[0]), [
		"diagnostics", "graph", "projection", "boost"
		, "diagnostics", "graph", "projection", "boost"
	]);
});

test("recursive checked-record native verifier loads the producer fixture closure", async () => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	const fixture = await mutualCheckedRecordNativeFixture(producerCommit);
	assert.equal(fixture.mutualCheckedRecordFixtureRoot
		, mutualCheckedRecordFixtureRoot);
	assert.equal(fixture.mutualCheckedRecordModule, mutualCheckedRecordModule);
	for(const route of ["ordinary", "reviewed"])
		assert.deepEqual(fixture.mutualCheckedRecordConfiguration(route)
			, mutualCheckedRecordConfiguration(route));
	assert.deepEqual(fixture.mutualCheckedRecordReview()
		, mutualCheckedRecordReview());
	assert.deepEqual(fixture.mutualCheckedRecordRefinements
		, mutualCheckedRecordRefinements);
});

test("recursive checked-record native CLI rejects incomplete arguments and TAP", () => {
	const commit = "a".repeat(40);
	const args = [
		"--route", "ordinary", "--producer", commit
		, "--directory", "records", "--tap", "run.tap", "--floor", "2.38"
	];
	assert.deepEqual(parseMutualCheckedRecordNativeCiArgs(args), {
		route: "ordinary", producer: commit, directory: "records", tap: "run.tap"
		, floor: "2.38"
	});
	for(const changed of [args.slice(2), [...args, "--route", "reviewed"]
		, args.with(1, "other"), args.with(3, "HEAD")])
		assert.throws(() => parseMutualCheckedRecordNativeCiArgs(changed));
	const name = "installed mutual checked-record C/C++ packages reproduce and relocate ordinary";
	const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
	assertMutualCheckedRecordNativeCiTap(tap, "ordinary");
	assert.throws(() => assertMutualCheckedRecordNativeCiTap(
		tap.replace("# pass 1", "# pass 0"), "ordinary"));
	assert.throws(() => assertMutualCheckedRecordNativeCiTap(
		tap.replace("ok 1", "not ok 1"), "ordinary"));
});

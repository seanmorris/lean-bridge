/**
 * Cheap source and generated-header controls for native value-index acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	assertCheckedRecordValueIndexNativeTap
	, parseCheckedRecordValueIndexNativeCiArgs
} from "./checked-record-value-index-native-ci-report.mjs";
import {
	checkedRecordValueIndexNativeCaller
	, checkedRecordValueIndexNativeProfiles
	, checkedRecordValueIndexNativeRoutes
	, checkedRecordValueIndexNativeSelection
	, parseCheckedRecordValueIndexNativeResult
} from "./checked-record-value-index-native-fixture.mjs";
import {
	observeCheckedRecordValueIndexNativeRuntime
} from "./checked-record-value-index-native-runtime.mjs";

const run = promisify(execFile);
const tap = (tests, skipped = 0) => `TAP version 13\n${Array.from({ length: tests }
	, (_, index) => `# Subtest: accepted ${index}\n`
		+ `ok ${index + 1} - accepted ${index}${index >= tests - skipped ? " # SKIP" : ""}\n`
		+ "  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n").join("")}1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${tests - skipped}\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n# duration_ms 2\n`;
const namedTap = name => tap(1).replaceAll("accepted 0", name);

test("value-index native selections preserve all four independent author routes", () => {
	for(const route of checkedRecordValueIndexNativeRoutes)
	{
		const selection = checkedRecordValueIndexNativeSelection(route);
		assert.deepEqual(Object.keys(selection.configuration.targets), ["c", "cpp"]);
		const counterpart = selection.reviewed
			? route.replace("reviewed-ir", "ordinary-source")
			: route.replace("ordinary-source", "reviewed-ir");
		assert.equal(reviewedContractDifference(selection.expected
			, checkedRecordValueIndexNativeSelection(counterpart).expected), null);
		assert.equal(selection.resultOnly, route.startsWith("result-only-"));
		assert.equal(selection.reviewed, route.endsWith("reviewed-ir"));
		assert.equal(selection.expected.declarations.length
			, selection.resultOnly ? 8 : 16);
		assert.equal(selection.expected.types.length, 8);
	}
	assert.throws(() => checkedRecordValueIndexNativeSelection("ordinary"));
});

test("value-index native callers distinguish semantic, shape and reviewed errors", async () => {
	for(const profile of checkedRecordValueIndexNativeProfiles)
		for(const route of checkedRecordValueIndexNativeRoutes)
		{
			const caller = await checkedRecordValueIndexNativeCaller(profile, route);
			assert.equal(caller.calls, caller.rejections ? 28 : 8);
			assert.equal(caller.rejections, caller.recoveries);
			assert.equal((caller.source.match(/Nat must be nonnegative/gu) ?? []).length
				, profile === "cpp" && caller.rejections ? 2 : 0);
			assert.equal((caller.source.match(
				/Invalid copied value, negative Nat or 16 MiB call limit exceeded/gu
			) ?? []).length, profile === "c" && caller.rejections ? 2 : 0);
			assert.equal((caller.source.match(/was rejected by CheckedRecordValueIndices/gu)
				?? []).length, caller.rejections ? 4 : 0);
			assert.equal((caller.source.match(/"value0 was rejected/gu) ?? []).length
				, selectionReviewed(route) && caller.rejections ? 4 : 0);
			assert.equal((caller.source.match(/"arg0 was rejected/gu) ?? []).length
				, !selectionReviewed(route) && caller.rejections ? 4 : 0);
			const receipt = JSON.stringify({
				calls: caller.calls, checks: caller.checks
				, recoveries: caller.recoveries, rejections: caller.rejections
			});
			assert.deepEqual(parseCheckedRecordValueIndexNativeResult(receipt, caller)
				, JSON.parse(receipt));
		}
});

const selectionReviewed = route => route.endsWith("reviewed-ir");

test("independent C11/GMP and C++20 callers compile against generated public headers"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-native-source-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const route of checkedRecordValueIndexNativeRoutes)
	{
		const selection = checkedRecordValueIndexNativeSelection(route);
		const cFiles = generateGmpProjection(selection.expected).files;
		const cppFiles = {
			...generateCBindingPackage(selection.expected)
			, ...generateCppBindingPackage(selection.expected)
			, ...boostSources()
		};
		for(const profile of checkedRecordValueIndexNativeProfiles)
		{
			const directory = join(root, route, profile);
			const files = profile === "c" ? cFiles : cppFiles;
			for(const [path, source] of Object.entries(files))
				await saveLakeFile(directory, path, source);
			const caller = await checkedRecordValueIndexNativeCaller(profile, route);
			const extension = profile === "c" ? "c" : "cpp";
			const sourcePath = join(directory, `consumer.${extension}`);
			await saveLakeFile(directory, `consumer.${extension}`, caller.source);
			await run(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", [
				`-std=${profile === "c" ? "c11" : "c++20"}`
				, "-Wall", "-Wextra", "-Werror", "-fsyntax-only"
				, "-I", join(directory, "include"), sourcePath
			]);
			assert.equal(await readFile(sourcePath, "utf8"), caller.source);
		}
	}
	}
);

test("value-index native hosted checker closes CLI scope and terminal TAP", () => {
	const options = {
		route: "ordinary-source", producer: "a".repeat(40)
		, consumer: "b".repeat(40), checker: "c".repeat(40)
		, directory: "records", "acceptance-tap": "acceptance.tap"
		, "controls-tap": "controls.tap", runtime: "runtime.json", floor: "2.38"
	};
	const args = Object.entries(options).flatMap(([key, value]) => [
		`--${key}`, value
	]);
	assert.deepEqual(parseCheckedRecordValueIndexNativeCiArgs(args), options);
	const name = "installed value-index records reproduce and relocate in C/C++ for ordinary-source";
	assertCheckedRecordValueIndexNativeTap(namedTap(name), 1, 0, name);
	assertCheckedRecordValueIndexNativeTap(tap(12, 4), 12, 4);
	for(const changed of [
		args.slice(2), [...args, "--route", "ordinary-source"]
		, args.with(1, "ordinary"), args.with(3, "head")
		, args.with(args.indexOf("--floor") + 1, "latest")
	]) assert.throws(() => parseCheckedRecordValueIndexNativeCiArgs(changed));
	for(const changed of [
		tap(11, 10), tap(12, 3), tap(12, 4).replace("# fail 0", "# fail 1")
		, tap(12, 4).replace("ok 1", "not ok 1")
	]) assert.throws(() => assertCheckedRecordValueIndexNativeTap(
		changed, 12, 4));
	assert.throws(() => assertCheckedRecordValueIndexNativeTap(
		namedTap(name.replace("ordinary-source", "reviewed-ir")), 1, 0, name));
});

test("native runtime snapshot is canonical and agrees with direct observation", async () => {
	const expected = observeCheckedRecordValueIndexNativeRuntime();
	assert.deepEqual(Object.keys(expected).sort()
		, ["arch", "cc", "cpp", "glibc", "platform"]);
	assert.match(expected.glibc, /^2\.[0-9]+$/u);
	assert.ok(expected.cc.length > 5 && expected.cpp.length > 5);
	const result = await run(process.execPath, [
		"scripts/snapshot-checked-record-value-index-native.mjs"
	]);
	assert.equal(result.stderr, "");
	assert.deepEqual(JSON.parse(result.stdout), expected);
});

test("value-index native workflow requires all routes and preserves failures", async () => {
	const source = await readFile(
		".github/workflows/checked-record-value-index-native.yml", "utf8");
	const verify = value => {
		assert.ok(value.startsWith(
			"name: Value-indexed checked records in C and C++\n"));
		assert.ok(value.includes(
			"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
		assert.ok(value.includes("permissions:\n  contents: read\n"));
		assert.ok(value.includes("runs-on: ubuntu-24.04\n"));
		assert.ok(value.includes("timeout-minutes: 240\n"));
		assert.ok(value.includes("timeout-minutes: 180\n"));
		assert.ok(value.includes("persist-credentials: false"));
		assert.ok(value.includes(
			"bash scripts/run-checked-record-value-index-native-ci.sh\n"));
		assert.ok(value.includes(
			"if: always()\n        uses: actions/upload-artifact@v7\n"));
		assert.ok(value.includes("if-no-files-found: error"));
		assert.ok(value.includes(
			"if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1\n"));
		assert.doesNotMatch(value
			, /continue-on-error:|strategy:|matrix:|needs:|install-nix|nix build/u);
	};
	verify(source);
	for(const bypass of [
		source.replace("workflow_dispatch:\n", "")
		, source.replace("persist-credentials: false", "persist-credentials: true")
		, source.replace("if: always()\n", "")
		, source.replace("if-no-files-found: error", "if-no-files-found: warn")
		, source.replace("timeout-minutes: 180", "timeout-minutes: 10")
	]) assert.throws(() => verify(bypass));
});

test("value-index native runner serializes exact routes and source identities", async () => {
	const source = await readFile(
		"scripts/run-checked-record-value-index-native-ci.sh", "utf8");
	assert.match(source, /set -euo pipefail/u);
	assert.match(source, /ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir/u);
	assert.match(source, /--producer "\$revision" --consumer "\$revision"/u);
	assert.match(source, /--checker "\$revision"/u);
	assert.match(source, /--floor 2\.38/u);
	assert.ok(source.includes('--test-name-pattern="^${name//+/\\\\+}$"'));
	assert.match(source
		, /tests\/helpers\/checked-record-value-index-native-installed-tests\.mjs/u);
	assert.doesNotMatch(source, /2>&1 \| tee "\$output\/verification\.json"/u);
	assert.match(source, /cmp "\$output\/runtime-before\.json" "\$output\/runtime-after\.json"/u);
	assert.match(source, /cmp "\$output\/runtime-before\.json" "\$output_root\/records\/\$route\/runtime\.json"/u);
	for(const variable of [
		"LEAN_BRIDGE_VALUE_INDEX_NATIVE_TEST"
		, "LEAN_BRIDGE_VALUE_INDEX_NATIVE_ROUTES"
		, "LEAN_BRIDGE_VALUE_INDEX_NATIVE_OUTPUT"
		, "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR"
	]) assert.ok(source.includes(variable));
	const name = "installed value-index records reproduce and relocate in C/C++ for ordinary-source";
	const pattern = (await run("/usr/bin/bash", ["-c"
		, 'name="$1"; printf "%s" "^${name//+/\\\\+}$"', "bash", name])).stdout;
	const selector = new RegExp(pattern);
	assert.equal(selector.test(name), true);
	assert.equal(selector.test(name.replace("ordinary-source", "reviewed-ir")), false);
});

test("native evidence controls cover semantic, Git, package, caller and runtime drift"
	, async () => {
	const source = await readFile(
		"tests/helpers/checked-record-value-index-native-controls.mjs", "utf8");
	for(const value of [
		"closed Bool value-index mutation", "non-provenance Binding IR change"
		, "Unicode String value-index mutation"
		, "same text under another value-index kind"
		, "missing value-index provenance", "missing value-index record"
		, "author input must remain bound to Git", "prepared package archive byte"
		, "installed C caller byte", "installed package Binding IR identity"
		, "retained installed execution stdout", "installed execution counter"
		, "independent runtime identity"
	]) assert.ok(source.includes(value), value);
	assert.equal((source.match(/await assert\.rejects\(/gu) ?? []).length, 9);
	assert.equal((source.match(/await assert\.rejects\(verify\(semantic\)/gu) ?? []).length, 1);
	assert.match(source, /provenanceControls\+\+/u);
	assert.match(source, /await verify\(originals\);/u);
	}
);

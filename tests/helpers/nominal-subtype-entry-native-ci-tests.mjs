/**
 * Controls for the separate recurring native entry measurement lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypeEntryNativeRecordPaths, parseNominalSubtypeEntryNativeCiArgs } from "./nominal-subtype-entry-native-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);

test("nominal native entry checker requires one explicit closed selection", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", floor: "2.38" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeEntryNativeCiArgs(args), options);
	for(const key of Object.keys(options))
		assert.throws(() => parseNominalSubtypeEntryNativeCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
	for(const changes of [{ route: "unknown" }, { mode: "unknown" }, { producer: "HEAD" }, { floor: "ambient" }, { extra: "yes" }])
		assert.throws(() => parseNominalSubtypeEntryNativeCiArgs(argsOf({ ...options, ...changes })));
});

test("nominal native entry inventory includes dispatch only for constructor-bearing C", () => {
	const full = nominalSubtypeEntryNativeRecordPaths("full");
	const resultOnly = nominalSubtypeEntryNativeRecordPaths("result-only");
	assert.deepEqual(full.filter(path => path.endsWith("dispatch.json")), ["c/dispatch.json"]);
	assert.deepEqual(resultOnly.filter(path => path.endsWith("dispatch.json")), []);
	assert.equal(full.length, resultOnly.length + 1);
});

test("nominal native entry workflow keeps measurement separate and mandatory", async () => {
	const workflow = await readFile(".github/workflows/nominal-subtype-entry-native.yml", "utf8");
	const shell = await readFile("scripts/run-nominal-subtype-entry-native-ci.sh", "utf8");
	assert.ok(workflow.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(workflow.includes("fetch-depth: 0\n          persist-credentials: false"));
	assert.ok(workflow.includes("bash scripts/run-nominal-subtype-entry-native-ci.sh"));
	assert.ok(workflow.includes("if: always() && steps.acceptance.outcome != 'success'"));
	for(const source of ["export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_DISPATCH=1"
		, "export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "for route in ordinary reviewed; do", "for mode in full result-only; do"
		, "check-nominal-subtype-entry-native-ci.mjs"])
		assert.ok(shell.includes(source), source);
	assert.doesNotMatch(workflow, /continue-on-error:|if-no-files-found: ignore/u);
});

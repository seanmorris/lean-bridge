/**
 * Callback lifetime execution and receipts cannot silently leave CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedCppCallbackResultCi, ownedCppCallbackResultReports } from "./helpers/owned-cpp-callback-result-ci.mjs";

test("CI requires both C++ callback source paths, installed archives and every runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedCppCallbackResultCi(workflow, manifest), {
		tests: 12, testFiles: 3, reports: 12, failurePropagated: true
	});
	for(const line of [
		"          npm run test:owned-cpp-callback-results 2>&1 | tee build/owned-cpp-callback-results.log"
		, ...["tests 12", "pass 12", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-cpp-callback-results.log`)
		, ...ownedCppCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-cpp-callback-results/"
		, "            build/owned-cpp-callback-results.log"
		, "            build/owned-cpp-callback-result-runtime.log"
		, "      - owned-cpp-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedCppCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["      - name: Verify C++ callback-result lifetimes\n", "      - name: Verify C++ callback-result lifetimes\n        if: false\n"]
		, ["  owned-cpp-callback-results:\n", "  owned-cpp-callback-results:\n    continue-on-error: true\n"]
		, ["        if: needs.owned-cpp-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedCppCallbackResultCi(workflow.replace(before, after), manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-cpp-callback-results"] = disabled.scripts["test:owned-cpp-callback-results"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedCppCallbackResultCi(workflow, disabled));
});

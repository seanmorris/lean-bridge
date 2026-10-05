/**
 * Callback lifetime execution and receipts cannot silently leave CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPythonCallbackResultCi, ownedPythonCallbackResultReports } from "./helpers/owned-python-callback-result-ci.mjs";

test("CI requires both Python callback source paths, installed archives and every runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedPythonCallbackResultCi(workflow, manifest), {
		tests: 13, testFiles: 4, reports: 13, failurePropagated: true
	});
	const missingRust = workflow.replace(/( {2}owned-python-callback-results:\n[\s\S]*?) {10}bash scripts\/bootstrap-rust-ci\.sh\n/u, "$1");
	assert.notEqual(missingRust, workflow);
	assert.throws(() => assertOwnedPythonCallbackResultCi(missingRust, manifest));
	for(const line of [
		"          npm run test:owned-python-callback-results 2>&1 | tee build/owned-python-callback-results.log"
		, ...["tests 13", "pass 13", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-python-callback-results.log`)
		, ...ownedPythonCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-python-callback-results/"
		, "            build/owned-python-callback-results.log"
		, "            build/owned-python-callback-result-runtime.log"
		, "      - owned-python-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedPythonCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["      - name: Verify Python callback-result lifetimes\n", "      - name: Verify Python callback-result lifetimes\n        if: false\n"]
		, ["  owned-python-callback-results:\n", "  owned-python-callback-results:\n    continue-on-error: true\n"]
		, ["        if: needs.owned-python-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedPythonCallbackResultCi(workflow.replace(before, after), manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-python-callback-results"] = disabled.scripts["test:owned-python-callback-results"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedPythonCallbackResultCi(workflow, disabled));
});

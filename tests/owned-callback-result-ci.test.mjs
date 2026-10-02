/**
 * Callback lifetime execution and receipts cannot silently leave CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedCallbackResultCi, ownedCallbackResultReports } from "./helpers/owned-callback-result-ci.mjs";

test("CI requires both callback source paths, installed archives and every runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedCallbackResultCi(workflow, manifest), {
		tests: 33, testFiles: 11, reports: 23, failurePropagated: true
	});
	for(const line of [
		"          npm run test:owned-callback-results 2>&1 | tee build/owned-callback-results.log"
		, ...["tests 33", "pass 33", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-callback-results.log`)
		, ...ownedCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-callback-results/"
		, "            build/owned-callback-results.log"
		, "            build/owned-callback-result-runtime.log"
		, "      - owned-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["      - name: Verify callback-result lifetimes\n", "      - name: Verify callback-result lifetimes\n        if: false\n"]
		, ["  owned-callback-results:\n", "  owned-callback-results:\n    continue-on-error: true\n"]
		, ["        if: needs.owned-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedCallbackResultCi(workflow.replace(before, after), manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-callback-results"] = disabled.scripts["test:owned-callback-results"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedCallbackResultCi(workflow, disabled));
});

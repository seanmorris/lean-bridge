/**
 * Callback lifetime execution and receipts cannot silently leave CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedRustCallbackResultCi, ownedRustCallbackResultReports } from "./helpers/owned-rust-callback-result-ci.mjs";

test("CI requires both Rust callback source paths, installed archives and every runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedRustCallbackResultCi(workflow, manifest), {
		tests: 13, testFiles: 4, reports: 12, failurePropagated: true
	});
	for(const line of [
		"          npm run test:owned-rust-callback-results 2>&1 | tee build/owned-rust-callback-results.log"
		, ...["tests 13", "pass 13", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-rust-callback-results.log`)
		, ...ownedRustCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-rust-callback-results/"
		, "            build/owned-rust-callback-results.log"
		, "            build/owned-rust-callback-result-runtime.log"
		, "      - owned-rust-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedRustCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["      - name: Verify Rust callback-result lifetimes\n", "      - name: Verify Rust callback-result lifetimes\n        if: false\n"]
		, ["  owned-rust-callback-results:\n", "  owned-rust-callback-results:\n    continue-on-error: true\n"]
		, ["        if: needs.owned-rust-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedRustCallbackResultCi(workflow.replace(before, after), manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-rust-callback-results"] = disabled.scripts["test:owned-rust-callback-results"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedRustCallbackResultCi(workflow, disabled));
});

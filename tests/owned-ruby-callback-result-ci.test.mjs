/**
 * Callback lifetime execution and receipts cannot silently leave CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedRubyCallbackResultCi, ownedRubyCallbackResultReports } from "./helpers/owned-ruby-callback-result-ci.mjs";

test("CI requires both Ruby callback source paths, installed archives and every runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedRubyCallbackResultCi(workflow, manifest), {
		tests: 12, testFiles: 4, reports: 12, failurePropagated: true
	});
	const missingRust = workflow.replace(/( {2}owned-ruby-callback-results:\n[\s\S]*?) {10}bash scripts\/bootstrap-rust-ci\.sh\n/u, "$1");
	assert.notEqual(missingRust, workflow);
	assert.throws(() => assertOwnedRubyCallbackResultCi(missingRust, manifest));
	const missingRuby = workflow.replace("        uses: ruby/setup-ruby@v1\n        with:\n          ruby-version: '3.3.12'\n", "");
	assert.notEqual(missingRuby, workflow);
	assert.throws(() => assertOwnedRubyCallbackResultCi(missingRuby, manifest));
	for(const line of [
		"          npm run test:owned-ruby-callback-results 2>&1 | tee build/owned-ruby-callback-results.log"
		, ...["tests 12", "pass 12", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-ruby-callback-results.log`)
		, ...ownedRubyCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-ruby-callback-results/"
		, "            build/owned-ruby-callback-results.log"
		, "            build/owned-ruby-callback-result-runtime.log"
		, "      - owned-ruby-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedRubyCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["      - name: Verify Ruby callback-result lifetimes\n", "      - name: Verify Ruby callback-result lifetimes\n        if: false\n"]
		, ["  owned-ruby-callback-results:\n", "  owned-ruby-callback-results:\n    continue-on-error: true\n"]
		, ["        if: needs.owned-ruby-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedRubyCallbackResultCi(workflow.replace(before, after), manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-ruby-callback-results"] = disabled.scripts["test:owned-ruby-callback-results"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedRubyCallbackResultCi(workflow, disabled));
});

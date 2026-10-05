/**
 * JVM callback CI must execute and reconstruct all reports without skipped tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJvmCallbackResultCi, ownedJvmCallbackResultReports } from "./helpers/owned-jvm-callback-result-ci.mjs";

test("CI requires JVM callback execution and authenticated reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedJvmCallbackResultCi(workflow, manifest), {
		tests: 28, evidenceTests: 10, reports: 24, failurePropagated: true
	});
	for(const line of [
		...ownedJvmCallbackResultReports.map(path => "          test -s " + path)
		, ...["results", "evidence"].flatMap(kind => [
			`          npm run test:owned-jvm-callback-${kind} 2>&1 | tee build/owned-jvm-callback-${kind}.log`
			, ...["tests", "pass", "fail", "cancelled", "skipped"].map(summary =>
				`          rg '^# ${summary} ${["tests", "pass"].includes(summary) ? kind === "results" ? 28 : 10 : 0}$' build/owned-jvm-callback-${kind}.log`)
		])
		, "            build/owned-jvm-callback-results/"
		, "            build/owned-jvm-callback-evidence.log"
		, "      - owned-jvm-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedJvmCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["  owned-jvm-callback-results:\n", "  owned-jvm-callback-results:\n    continue-on-error: true\n"]
		, ["      - name: Verify JVM callback-result lifetimes and installed consumers\n"
			, "      - name: Verify JVM callback-result lifetimes and installed consumers\n        if: false\n"]
		, ["      - name: Reconstruct JVM callback execution evidence\n"
			, "      - name: Reconstruct JVM callback execution evidence\n        if: false\n"]
		, ["        if: needs.owned-jvm-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedJvmCallbackResultCi(workflow.replace(before, after), manifest));
	}
	for(const name of ["test:owned-jvm-callback-results", "test:owned-jvm-callback-evidence"])
	{
		const disabled = structuredClone(manifest);
		disabled.scripts[name] = disabled.scripts[name].replace("_TEST=1", "_TEST=0");
		assert.throws(() => assertOwnedJvmCallbackResultCi(workflow, disabled));
	}
});

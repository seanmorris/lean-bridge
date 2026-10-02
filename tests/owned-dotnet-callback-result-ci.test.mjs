/**
 * CI must execute and reconstruct both .NET source paths without skips.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedDotnetCallbackResultCi, ownedDotnetCallbackResultReports } from "./helpers/owned-dotnet-callback-result-ci.mjs";

test("CI requires installed .NET callback execution and authenticated reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedDotnetCallbackResultCi(workflow, manifest), {
		tests: 26, evidenceTests: 8, testFiles: 9, reports: 26
		, failurePropagated: true
	});
	for(const line of [
		"          npm run test:owned-dotnet-callback-results 2>&1 | tee build/owned-dotnet-callback-results.log"
		, "          npm run test:owned-dotnet-callback-evidence 2>&1 | tee build/owned-dotnet-callback-evidence.log"
		, ...["results", "evidence"].flatMap(kind => ["tests", "pass", "fail", "cancelled", "skipped"].map(summary =>
			`          rg '^# ${summary} ${["tests", "pass"].includes(summary) ? kind === "results" ? 26 : 8 : 0}$' build/owned-dotnet-callback-${kind}.log`))
		, ...ownedDotnetCallbackResultReports.map(path => "          test -s " + path)
		, "            build/owned-dotnet-callback-results/"
		, "            build/owned-dotnet-callback-evidence.log"
		, "      - owned-dotnet-callback-results"
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedDotnetCallbackResultCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const [before, after] of [
		["  owned-dotnet-callback-results:\n", "  owned-dotnet-callback-results:\n    continue-on-error: true\n"]
		, ["      - name: Verify .NET callback-result lifetimes\n", "      - name: Verify .NET callback-result lifetimes\n        if: false\n"]
		, ["      - name: Reconstruct .NET callback execution evidence\n", "      - name: Reconstruct .NET callback execution evidence\n        if: false\n"]
		, ["        if: needs.owned-dotnet-callback-results.result != 'success'\n        run: exit 1\n", "        run: true\n"]
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedDotnetCallbackResultCi(workflow.replace(before, after), manifest));
	}
	for(const name of ["test:owned-dotnet-callback-results", "test:owned-dotnet-callback-evidence"])
	{
		const disabled = structuredClone(manifest); disabled.scripts[name] = disabled.scripts[name].replace("_TEST=1", "_TEST=0");
		assert.throws(() => assertOwnedDotnetCallbackResultCi(workflow, disabled));
	}
});

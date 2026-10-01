/**
 * Receiver CI cannot pass without the complete installed acceptance command.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJavaScriptReceiverCi, ownedJavaScriptReceiverReports } from "./helpers/owned-javascript-receiver-ci.mjs";

test("JavaScript receiver CI requires every source path, configuration and report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedJavaScriptReceiverCi(workflow, manifest), { tests: 28, testFiles: 9, reports: 23, failurePropagated: true });
});

test("JavaScript receiver CI rejects omitted gates, disabled execution and lost reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	for(const [before, after] of [
		["npm run test:owned-javascript-receivers", "true"]
		, ["      - name: Verify JavaScript receiver packages\n", "      - name: Verify JavaScript receiver packages\n        if: false\n"]
		, ["      - owned-javascript-receivers\n", ""]
		, ["        if: needs.owned-javascript-receivers.result != 'success'", "        if: false"]
		, ...["tests 28", "pass 28", "fail 0", "cancelled 0", "skipped 0"].map(line => [`          rg '^# ${line}$' build/owned-javascript-receivers.log\n`, ""])
		, ...ownedJavaScriptReceiverReports.map(path => ["          test -s " + path + "\n", ""])
		, ["            build/owned-javascript-receiver-packaging/\n", ""]
	]) {
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow);
		assert.throws(() => assertOwnedJavaScriptReceiverCi(changed, manifest));
	}
	for(const source of [workflow.replaceAll(" ripgrep", ""), workflow.replace("  owned-javascript-receivers:\n", "  owned-javascript-receivers:\n    continue-on-error: true\n")])
		assert.throws(() => assertOwnedJavaScriptReceiverCi(source, manifest));
	for(const before of ["_TEST=1", "--expose-gc", "tests/owned-javascript-receiver-resource-packaging.test.mjs"])
	{
		const changed = structuredClone(manifest);
		changed.scripts["test:owned-javascript-receivers"] = changed.scripts["test:owned-javascript-receivers"].replace(before, "");
		assert.throws(() => assertOwnedJavaScriptReceiverCi(workflow, changed));
	}
});

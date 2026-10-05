/**
 * Fail closed if WIT receiver CI omits execution, prerequisites or observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedWitReceiverCi, ownedWitReceiverReports } from "./helpers/wit-owned-receiver-ci.mjs";

test("WIT receiver CI requires complete compiled and installed execution", async () => {
	assertOwnedWitReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8")
		, JSON.parse(await readFile("package.json", "utf8")));
});

test("WIT receiver CI rejects skipped steps, borrowed prerequisites and missing reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	const job = workflow.match(/^ {2}owned-wit-receivers:\n([^]*?)(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(job);
	const removals = ["          npm run test:owned-wit-receivers 2>&1 | tee build/wit-owned-receivers.log\n"
		, "          rg '^# skipped 0$' build/wit-owned-receivers.log\n"
		, "          set -euo pipefail\n", "libgmp-dev", "ripgrep"
		, ...ownedWitReceiverReports.flatMap(path => ["          test -s " + path + "\n", "            " + path + "\n"])];
	for(const before of removals)
	{
		const changed = workflow.replace(job, job.replace(before, ""));
		assert.notEqual(changed, workflow, before);
		assert.throws(() => assertOwnedWitReceiverCi(changed, manifest), undefined, before);
	}
	for(const inserted of ["        if: false\n", "        continue-on-error: true\n"])
		assert.throws(() => assertOwnedWitReceiverCi(workflow.replace("      - name: Execute WIT receiver acceptance\n"
			, "      - name: Execute WIT receiver acceptance\n" + inserted), manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-wit-receivers"] = "node --test tests/wit-owned-receiver-model.test.mjs";
	assert.throws(() => assertOwnedWitReceiverCi(workflow, changed));
});

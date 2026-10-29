/**
 * Hosted systems HostNull producer contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted systems HostNull preserves the complete 40-cell acceptance", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const runner = await readFile("scripts/run-host-null-systems-ci.sh", "utf8");
	const checker = await readFile("scripts/check-host-null-systems-ci.mjs", "utf8");
	assert.match(workflow, /host-null-systems:[\s\S]*name: Systems HostNull acceptance/u);
	assert.match(workflow, /name: Qualify HostNull in prepared systems packages[\s\S]*id: host_null_systems[\s\S]*bash scripts\/run-host-null-systems-ci\.sh/u);
	assert.match(workflow, /name: Preserve systems HostNull acceptance[\s\S]*host-null-systems-\$\{\{ github\.sha \}\}[\s\S]*build\/host-null-systems-ci\/[\s\S]*if-no-files-found: error/u);
	assert.match(workflow, /name: Enforce systems HostNull support[\s\S]*steps\.host_null_systems\.outcome != 'success'[\s\S]*run: exit 1/u);
	assert.match(runner, /LEAN_BRIDGE_SYSTEMS_HOST_NULL_ROUTES=ordinary,reviewed/u);
	assert.match(runner, /--test-name-pattern='\^installed systems HostNull preserves all five positions on both author routes\$'/u);
	assert.match(runner, /node scripts\/check-host-null-systems-ci\.mjs/u);
	for(const required of [
		"summary.cells.length, 40", "consumerSourceRemovedBeforeRelocatedExecution"
		, "sourceFreeRelocatedExecution", "invalidRepresentationRejected"
		, "packageFileSetSha256", "hostNullSystemsProfiles"
		, "verifyPackageSetReceipt", "dependency-handoff"
	]) assert.ok(checker.includes(required), required);
});

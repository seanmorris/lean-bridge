/**
 * Hosted systems HostNull producer contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hostNullSystemsWitTypes }
	from "./helpers/host-null-systems-installed.mjs";

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
	assert.match(runner, /mkdir -p build/u);
	assert.doesNotMatch(runner, /mkdir -p "\$output"/u);
	for(const required of [
		"summary.cells.length, 40", "consumerSourceRemovedBeforeRelocatedExecution"
		, "sourceFreeRelocatedExecution", "invalidRepresentationRejected"
		, "packageFileSetSha256", "hostNullSystemsProfiles"
		, "verifyPackageSetReceipt", "dependency-handoff"
		, "bindingIrSemanticSha256"
		, "summary.routes.map(route => route.bindingIrSha256)).size\n\t, summary.routes.length"
		, "summary.routes.map(route => route.bindingIrSemanticSha256)).size, 1"
		, "expectedBindingIrSemanticSha256"
	]) assert.ok(checker.includes(required), required);
	assert.deepEqual(hostNullSystemsWitTypes.map(String), [
		"/type bridge-value-1 = option<u32>/u"
		, "/type bridge-value-2 = option<u32>/u"
		, "/type bridge-value-3 = option<bridge-value-2>/u"
		, "/type bridge-value-4 = option<bridge-value-1>/u"
	]);
});

/**
 * Authenticate managed CI routing, command preservation and original receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import { historicalTypeSurfaceCells as typeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { assertNativeForkRepair } from "./native-fork-repair-evidence.mjs";
import { nativeForkRepairPath } from "./native-fork-repair-history.mjs";
import { assertManagedCiIsolation } from "./managed-ci-isolation.mjs";
import { managedCiIsolationBaseline, managedCiIsolationChangedPaths, managedCiIsolationAddedPaths, reverseManagedCiIsolation } from "./managed-ci-isolation-history.mjs";
import { beforeOwnedJvmPackages, ownedJvmHistoricalBytes } from "./owned-jvm-source-history.mjs";

export const managedCiIsolationCommand = "node --test tests/managed-ci-isolation.test.mjs";
export const managedCiIsolationScope = {
	profiles: ["dotnet", "jvm", "ruby"], timeoutMinutesPerProfile: 240
	, failFast: false, baselineRetained: true, acceptanceCommandsRetained: true
	, profileSpecificArtifacts: true, installedExecutionClaim: false
	, promotedCells: 0
};

/**
 * Verify current routing against whole-file-authenticated original commands.
 *
 * @param record - Frozen sources, exact edits and terminal routing-test log.
 * @param replay - Also validate the complete predecessor evidence chain.
 */
export const assertManagedCiIsolationEvidence = async (record, replay = true) => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "managed-ci-isolation");
	assert.equal(record.baselineRevision, managedCiIsolationBaseline);
	assert.deepEqual(record.scope, managedCiIsolationScope);
	assert.deepEqual(record.previous, { path: nativeForkRepairPath
		, sha256: "15837265b34832aa5515fa3420922fefd2d9459e41dc39f3d7f58098bfb84fe5" });
	const previousBytes = await readFile(record.previous.path);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes.toString("utf8"));
	const paths = [...new Set([...Object.keys(previous.sources), ...managedCiIsolationChangedPaths, ...managedCiIsolationAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sources).sort(), paths);
	assert.deepEqual(record.updates.map(item => item.path).sort(), managedCiIsolationChangedPaths);
	const updates = new Map(record.updates.map(item => [item.path, item]));
	for(const path of paths)
	{
		const bytes = ownedJvmHistoricalBytes(path, await readFile(path), record.sources[path]);
		assert.equal(sha256(bytes), record.sources[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.previousSha256, previous.sources[path], path);
			assert.equal(sha256(reverseManagedCiIsolation(bytes.toString("utf8"), update)), previous.sources[path], path);
		}
		else if(previous.sources[path]) assert.equal(record.sources[path], previous.sources[path], path);
	}
	const path = ".github/workflows/consumer-matrix.yml";
	const workflow = beforeOwnedJvmPackages(path, await readFile(path, "utf8"), record.sources[path]);
	const oldWorkflow = reverseManagedCiIsolation(workflow, updates.get(path));
	assert.deepEqual(record.routing, assertManagedCiIsolation(workflow, oldWorkflow));
	assert.equal(record.routing.commandsCompared, 6);
	assert.equal(record.run.command, managedCiIsolationCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 2, pass: 2, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok/mu);
	assert.deepEqual(record.inventory, previous.inventory);
	const { irSchema, consumers } = await readTypeSurface();
	const contracts = { irSchema, consumers };
	const document = JSON.parse(beforeOwnedJvmPackages("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), record.sources["docs/type-surface.v1.json"]));
	const old = JSON.parse(reverseManagedCiIsolation(await readFile("docs/type-surface.v1.json", "utf8"), updates.get("docs/type-surface.v1.json")));
	const expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(document, expected);
	assert.deepEqual(typeSurfaceCells(document, contracts), typeSurfaceCells(old, contracts));
	if(replay) await assertNativeForkRepair(previous);
};

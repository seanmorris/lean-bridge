#!/usr/bin/env node
/**
 * Apply, integrate and record the nominal Subtype entry live-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileDependentCheckedRecordSourcePins }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	nominalSubtypeEntryLivePinRepairAddedPaths
	, nominalSubtypeEntryLivePinRepairHistoryPath
	, nominalSubtypeEntryLivePinRepairImplementation
	, nominalSubtypeEntryLivePinRepairImplementationPaths
	, nominalSubtypeEntryLivePinRepairIntegrationPaths
	, nominalSubtypeEntryLivePinRepairPinCount
	, nominalSubtypeEntryLivePinRepairPins
	, nominalSubtypeEntryLivePinRepairPredecessor
} from "../tests/helpers/nominal-subtype-entry-live-pin-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

assert.ok(process.argv.length === 3
	&& ["--apply", "--prepare", "--record"].includes(process.argv[2])
, "Use --apply, then --prepare, then --record");
const mode = process.argv[2];
const inventoryPath = nominalSubtypeEntryLivePinRepairImplementationPaths[0];
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const head = git(["rev-parse", "HEAD"]).trim();
const observations = inventory => JSON.stringify(inventory.observations);

const reconcile = async (paths, expected) => {
	const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
	const before = observations(inventory);
	const digests = new Map();
	for(const path of paths)
		digests.set(path, sha256(await readFile(path)));
	const result = reconcileDependentCheckedRecordSourcePins(inventory, digests);
	assert.equal(result.refreshed, expected);
	assert.equal(observations(result.inventory), before
		, "Live-pin repair cannot change support observations");
	await writeFile(inventoryPath
		, JSON.stringify(result.inventory, null, 2) + "\n");
	return result.refreshed;
};

if(mode === "--apply")
{
	assert.equal(head, nominalSubtypeEntryLivePinRepairPredecessor
		, "Application requires the exact nominal-entry publication head");
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"]), []);
	const allowed = [...nominalSubtypeEntryLivePinRepairAddedPaths].sort();
	assert.deepEqual(names(["ls-files", "--others", "--exclude-standard"])
		, allowed, "Only the repair implementation may be untracked");
	for(const pin of nominalSubtypeEntryLivePinRepairPins)
		assert.equal(sha256(await readFile(pin.path)), pin.currentSha256, pin.path);
	const refreshed = await reconcile(
		nominalSubtypeEntryLivePinRepairPins.map(pin => pin.path)
		, nominalSubtypeEntryLivePinRepairPinCount);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
		, [inventoryPath]);
	process.stdout.write(`Refreshed ${refreshed} publication live-source pins.\n`);
	process.exit(0);
}

const implementation = nominalSubtypeEntryLivePinRepairImplementation;
assert.match(implementation, /^[a-f0-9]{40}$/u
	, "Replace the pending implementation identity before integration");

if(mode === "--prepare")
{
	assert.equal(head, implementation
		, "Preparation requires the exact live-pin implementation commit");
	const expected = nominalSubtypeEntryLivePinRepairIntegrationPaths
		.filter(path => path !== inventoryPath).sort();
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
		, expected);
	assert.deepEqual(names(["ls-files", "--others", "--exclude-standard"]), []);
	const refreshed = await reconcile(expected, 3);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
		, [...nominalSubtypeEntryLivePinRepairIntegrationPaths].sort());
	process.stdout.write(`Refreshed ${refreshed} history-registration live-source pins.\n`);
	process.exit(0);
}

assert.equal(git(["show", "-s", "--format=%P", head]).trim(), implementation
	, "Recording requires the exact integration child of the repair commit");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, implementation, head])
, [...nominalSubtypeEntryLivePinRepairIntegrationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, implementation, head]), []);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, nominalSubtypeEntryLivePinRepairPredecessor, implementation])
, [...nominalSubtypeEntryLivePinRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, nominalSubtypeEntryLivePinRepairPredecessor, implementation])
, [...nominalSubtypeEntryLivePinRepairAddedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", head, "--"
	, nominalSubtypeEntryLivePinRepairHistoryPath]).trim(), "");

const updates = [await gitSourceHistoryTransition(inventoryPath
	, nominalSubtypeEntryLivePinRepairPredecessor, implementation)];
const integrationUpdates = [];
for(const path of nominalSubtypeEntryLivePinRepairIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(
		path, implementation, head));
const additions = [];
for(const path of nominalSubtypeEntryLivePinRepairAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only"
		, nominalSubtypeEntryLivePinRepairPredecessor, "--", path]).trim(), "");
	additions.push({ commit: implementation, path
		, currentSha256: sha256(git(["show", `${implementation}:${path}`])) });
}
const registration = {
	path: "tests/component-array-contract.test.mjs", count: 3
	, previousSha256: sha256(git(["show", `${implementation}:tests/component-array-contract.test.mjs`]))
	, currentSha256: sha256(git(["show", `${head}:tests/component-array-contract.test.mjs`]))
};

await writeFile(nominalSubtypeEntryLivePinRepairHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "nominal-subtype-entry-live-pin-repair-source-v1"
	, predecessorCommit: nominalSubtypeEntryLivePinRepairPredecessor
	, implementationCommit: implementation
	, integrationCommit: head
	, scope: "Refresh exactly 118 stale current-source hashes left by the nominal Subtype entry publication and exactly three history-registration hashes. Preserve every support observation, evidence record, ordering decision and immutable hosted artifact; add no support claim."
	, pinCount: nominalSubtypeEntryLivePinRepairPinCount
	, pins: nominalSubtypeEntryLivePinRepairPins
	, registrationPinCount: registration.count
	, registration
	, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${nominalSubtypeEntryLivePinRepairPinCount} publication and ${registration.count} registration pins.\n`);

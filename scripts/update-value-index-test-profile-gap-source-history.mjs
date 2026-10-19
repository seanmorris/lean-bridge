#!/usr/bin/env node
/**
 * Record the omitted value-index Core profile registrations from exact Git
 * blobs, refresh only their stale live pins, and regenerate their PHP table.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import {
	reverseValueIndexTestProfileGapHistoricalUpdate
	, reverseValueIndexTestProfileGapUpdate
	, valueIndexTestProfileGapAddedPaths
	, valueIndexTestProfileGapChangedPaths
	, valueIndexTestProfileGapDraftParent
	, valueIndexTestProfileGapHistoryPath
	, valueIndexTestProfileGapPredecessor
} from "../tests/helpers/value-index-test-profile-gap-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const phpReferencePath = "docs/php.md";
const profilePath = "src/adoption/test-profiles.mjs";
const componentContractPath = "tests/component-array-contract.test.mjs";
const expectedPreviousProfileSha256
	= "27ef2abeb252e0493ef2da3d5029a988e11c84d1107bbd8ffc4d83c5519d1e00";
const profileTransitions = Object.freeze([
	{ path: profilePath
		, previousCommit: "656a41590a2cb583cf1207483c19bfa5051040bd"
		, currentCommit: "e63c29988da07a5ab2925b45dc4465a140aeee49" }
	, { path: profilePath
		, previousCommit: "c8f51dbbe2cfd679087372aeb24f0b9b8f762a19"
		, currentCommit: "656a41590a2cb583cf1207483c19bfa5051040bd" }
	, { path: profilePath
		, previousCommit: "b6871a34c652ec846fbd05d04db2fbe99031a676"
		, currentCommit: "c8f51dbbe2cfd679087372aeb24f0b9b8f762a19" }
]);
const typeSurfaceTransitions = Object.freeze([
	{ path: inventoryPath
		, previousCommit: "c8f51dbbe2cfd679087372aeb24f0b9b8f762a19"
		, currentCommit: "656a41590a2cb583cf1207483c19bfa5051040bd" }
	, { path: inventoryPath
		, previousCommit: "d31c5a100fa55620ef3945626976cc3849ed8c3b"
		, currentCommit: "c8f51dbbe2cfd679087372aeb24f0b9b8f762a19" }
]);
const historyHubTransitions = Object.freeze([
	{ path: "tests/helpers/fin-refinement-source-history.mjs"
		, previousCommit: "973a39643b885b4e251da40af7ba2697ccd91c9e"
		, currentCommit: "93896ab11021e1c021e801f6c8ba7ac4ffbdf182" }
]);
const historicalMilestones = Object.freeze([
	...profileTransitions, ...typeSurfaceTransitions, ...historyHubTransitions
]);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, valueIndexTestProfileGapDraftParent
	, "value-index profile-gap history must stay on its exact draft parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, valueIndexTestProfileGapHistoryPath]).trim()
, "Never rewrite a committed value-index profile-gap ledger");
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...valueIndexTestProfileGapAddedPaths]).trim().split("\n")
	.filter(Boolean).sort(), [...valueIndexTestProfileGapAddedPaths].sort());

const previousInventory = git(["show"
	, `${valueIndexTestProfileGapPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(previousInventory);
const currentProfile = await readFile(profilePath, "utf8");
assert.equal(sha256(currentProfile), sha256(git(["show"
	, `${profileTransitions[0].currentCommit}:${profilePath}`])));
const pinSources = [
	{ path: profilePath, previousSha256: expectedPreviousProfileSha256
		, current: currentProfile, expectedCount: 94 }
	, { path: componentContractPath
		, previousSha256: sha256(git(["show"
			, `${valueIndexTestProfileGapPredecessor}:${componentContractPath}`]))
		, current: await readFile(componentContractPath, "utf8"), expectedCount: 3 }
];
const pinUpdates = [];
let pinCount = 0;
const refreshPins = (source, expectedCount) => {
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === source.path && file.sha256 === source.previousSha256)
		{
			file.sha256 = sha256(source.current);
			count++;
		}
	assert.equal(count, expectedCount, source.path);
	pinUpdates.push({ path: source.path
		, previousSha256: source.previousSha256
		, currentSha256: sha256(source.current), count });
	pinCount += count;
};
for(const source of pinSources) refreshPins(source, source.expectedCount);
const phpReferencePrevious = git(["show"
	, `${valueIndexTestProfileGapPredecessor}:${phpReferencePath}`]);
const phpReferenceSource = {
	path: phpReferencePath, previousSha256: sha256(phpReferencePrevious)
	, current: await readFile(phpReferencePath, "utf8")
};
let phpReferencePinned = false;
if(sha256(phpReferenceSource.current) !== phpReferenceSource.previousSha256)
{
	refreshPins(phpReferenceSource, 6);
	phpReferencePinned = true;
}
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
await generateReferenceDocs({ write: true });
phpReferenceSource.current = await readFile(phpReferencePath, "utf8");
if(!phpReferencePinned)
{
	refreshPins(phpReferenceSource, 6);
	await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
	await generateReferenceDocs({ write: true });
}
assert.equal(pinCount, 103
	, "profile-gap repair must refresh exactly 103 stale source pins");

assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"])
	, [...valueIndexTestProfileGapChangedPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...valueIndexTestProfileGapAddedPaths])
, [...valueIndexTestProfileGapAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-profile-gap-history-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		return [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
	};
	const updates = [];
	for(const path of valueIndexTestProfileGapChangedPaths)
	{
		const previous = git(["show"
			, `${valueIndexTestProfileGapPredecessor}:${path}`]);
		const current = await readFile(path, "utf8");
		assert.notEqual(current, previous, path);
		const update = { path, previousSha256: sha256(previous)
			, currentSha256: sha256(current), edits: await edits(previous, current) };
		assert.ok(update.edits.length > 0, path);
		assert.equal(reverseValueIndexTestProfileGapUpdate(current, update)
			, previous, path);
		updates.push(update);
	}
	const historicalTransitions = [];
	for(const item of historicalMilestones)
	{
		const previous = git(["show", `${item.previousCommit}:${item.path}`]);
		const current = git(["show", `${item.currentCommit}:${item.path}`]);
		const transition = { ...item, previousSha256: sha256(previous)
			, currentSha256: sha256(current), edits: await edits(previous, current) };
		assert.ok(transition.edits.length > 0, item.currentCommit);
		assert.equal(reverseValueIndexTestProfileGapHistoricalUpdate(current, transition)
			, previous, item.currentCommit);
		historicalTransitions.push(transition);
	}
	const groupedTransitions = Map.groupBy(historicalTransitions, item => item.path);
	const profileHistory = groupedTransitions.get(profilePath);
	assert.equal(profileHistory[0].currentSha256, sha256(currentProfile));
	for(const transitions of groupedTransitions.values())
		for(let index = 0; index < transitions.length - 1; index++)
			assert.equal(transitions[index].previousSha256
				, transitions[index + 1].currentSha256);
	const additions = [];
	for(const path of valueIndexTestProfileGapAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${valueIndexTestProfileGapPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(valueIndexTestProfileGapHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "value-index-test-profile-gap-source-v1"
		, predecessorCommit: valueIndexTestProfileGapPredecessor
		, draftParentCommit: valueIndexTestProfileGapDraftParent
		, pathsSha256: sha256(JSON.stringify(valueIndexTestProfileGapChangedPaths))
		, pinCount, pinUpdates, additions, historicalTransitions, updates
	}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${historicalTransitions.length} profile gaps, ${updates.length} source transitions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

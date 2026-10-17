#!/usr/bin/env node
/**
 * Record hosted inherited-record evidence registration without rewriting an
 * earlier source-history ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	inheritedCheckedRecordHostedEvidenceChangedPaths
	, inheritedCheckedRecordHostedEvidenceDraftParent
	, inheritedCheckedRecordHostedEvidenceHistoryPath
	, inheritedCheckedRecordHostedEvidencePredecessor
	, reverseInheritedCheckedRecordHostedEvidenceUpdate
} from "../tests/helpers/inherited-checked-record-hosted-evidence-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const profilePath = "src/adoption/test-profiles.mjs";
const hubPath = "tests/helpers/fin-refinement-source-history.mjs";
const dotnetRoot = "tests/inherited-checked-record-dotnet.test.mjs";
const dotnetRootPreviousRevision
	= "88362988165976dfc3e080a8ec9387cf7b2a92dd";
const addedTests = [
	"inherited-checked-record-hosted-evidence-history"
	, "inherited-checked-record-jvm-evidence"
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, inheritedCheckedRecordHostedEvidenceDraftParent
	, "Hosted evidence history must stay on its exact draft parent");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, inheritedCheckedRecordHostedEvidencePredecessor
	, inheritedCheckedRecordHostedEvidenceDraftParent]).status, 0
, "Hosted evidence predecessor must remain an ancestor");
assert.equal(git(["ls-tree", "--name-only"
	, inheritedCheckedRecordHostedEvidenceDraftParent, "--"
	, inheritedCheckedRecordHostedEvidenceHistoryPath]).trim(), ""
, "Never rewrite a committed hosted evidence ledger");
await assert.rejects(readFile(inheritedCheckedRecordHostedEvidenceHistoryPath)
	, { code: "ENOENT" });

const specs = [
	{ path: profilePath
		, previousRevision: inheritedCheckedRecordHostedEvidencePredecessor }
	, { path: hubPath
		, previousRevision: inheritedCheckedRecordHostedEvidencePredecessor }
	, { path: dotnetRoot, previousRevision: dotnetRootPreviousRevision }
];
const sources = new Map();
for(const spec of specs)
{
	const previous = git(["show", `${spec.previousRevision}:${spec.path}`]);
	const current = await readFile(spec.path, "utf8");
	assert.notEqual(current, previous, spec.path);
	sources.set(spec.path, { ...spec, previous, current });
}
for(const name of addedTests)
	assert.equal(sources.get(profilePath).current
		.split(`\t\t, "${name}"\n`).length, 2, name);

const inventoryPrevious = git(["show"
	, `${inheritedCheckedRecordHostedEvidencePredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const { path, previous, current } of sources.values())
{
	const previousSha256 = sha256(previous);
	const currentSha256 = sha256(current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count > 0)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.ok(pinCount > 0);
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	path: inventoryPath
	, previousRevision: inheritedCheckedRecordHostedEvidencePredecessor
	, previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-inherited-hosted-evidence-history-"
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
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
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
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of inheritedCheckedRecordHostedEvidenceChangedPaths)
	{
		const source = sources.get(path);
		assert.ok(source, path);
		const update = {
			path, previousRevision: source.previousRevision
			, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements = pinUpdates.map(pin => ({
			previous: pin.previousSha256, current: pin.currentSha256
			, count: pin.count
		}));
		else update.edits = await edits(source.previous, source.current);
		if(path === profilePath) update.addedTests = addedTests;
		assert.equal(reverseInheritedCheckedRecordHostedEvidenceUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-hosted-evidence-source-v1"
		, predecessorCommit: inheritedCheckedRecordHostedEvidencePredecessor
		, draftParentCommit: inheritedCheckedRecordHostedEvidenceDraftParent
		, pinCount, pinUpdates, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(inheritedCheckedRecordHostedEvidenceHistoryPath, record
		, { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} transitions and refreshed ${pinCount} pins.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

#!/usr/bin/env node
/**
 * Record the reviewed recursive Perl diagnostic correction once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	recursiveCheckedRecordPerlDiagnosticChangedPaths
	, recursiveCheckedRecordPerlDiagnosticDraftParent
	, recursiveCheckedRecordPerlDiagnosticEvidenceSourcePaths
	, recursiveCheckedRecordPerlDiagnosticHistoryPath
	, recursiveCheckedRecordPerlDiagnosticSourcePaths
	, recursiveCheckedRecordPerlDiagnosticSourcePredecessor
	, reverseRecursiveCheckedRecordPerlDiagnosticUpdate
} from "../tests/helpers/recursive-checked-record-perl-diagnostic-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, recursiveCheckedRecordPerlDiagnosticDraftParent
	, "recursive checked-record Perl diagnostic history is draft-only at its exact parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, recursiveCheckedRecordPerlDiagnosticHistoryPath]).trim()
, "Never rewrite a committed recursive checked-record Perl diagnostic ledger");

const inventoryPath = "docs/type-surface.v1.json";
const inventoryBefore = git(["show"
	, `${recursiveCheckedRecordPerlDiagnosticDraftParent}:${inventoryPath}`]);
const draft = await readFile(
	recursiveCheckedRecordPerlDiagnosticHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.sourcePredecessorCommit
		, recursiveCheckedRecordPerlDiagnosticSourcePredecessor);
	assert.equal(draft.draftParentCommit
		, recursiveCheckedRecordPerlDiagnosticDraftParent);
}
const currentInventory = await readFile(inventoryPath, "utf8");
const draftInventory = draft?.updates.find(item => item.path === inventoryPath);
const restoredInventory = draftInventory?.currentSha256 === sha256(currentInventory)
	? reverseRecursiveCheckedRecordPerlDiagnosticUpdate(
		currentInventory, draftInventory
	) : currentInventory;
assert.equal(restoredInventory, inventoryBefore
	, "Never overwrite unrecorded type-surface changes");

const sourcePaths = new Set(recursiveCheckedRecordPerlDiagnosticSourcePaths);
const previousCommit = path => sourcePaths.has(path)
	? recursiveCheckedRecordPerlDiagnosticSourcePredecessor
	: recursiveCheckedRecordPerlDiagnosticDraftParent;
const sources = new Map();
for(const path of recursiveCheckedRecordPerlDiagnosticChangedPaths)
{
	if(path === inventoryPath) continue;
	const revision = previousCommit(path);
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previousCommit: revision, previous, current });
}
const inventory = JSON.parse(inventoryBefore);
const pinSources = [];
for(const path of recursiveCheckedRecordPerlDiagnosticEvidenceSourcePaths)
{
	const current = sources.get(path)?.current ?? await readFile(path, "utf8");
	pinSources.push({ path, currentSha256: sha256(current) });
}
const pinHashes = new Map(pinSources.map(item => [
	item.path, item.currentSha256
]));
let pinCount = 0;
for(const entry of inventory.evidence) for(const file of entry.files)
{
	const currentSha256 = pinHashes.get(file.path);
	if(currentSha256 && file.sha256 !== currentSha256)
	{
		file.sha256 = currentSha256;
		pinCount++;
	}
}
assert.ok(pinCount > 0, "The diagnostic correction must refresh source pins");
const inventoryAfter = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previousCommit: recursiveCheckedRecordPerlDiagnosticDraftParent
	, previous: inventoryBefore, current: inventoryAfter
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-perl-diagnostic-history-draft-"
));
try
{
	const transition = async path => {
		const { previousCommit: revision, previous, current } = sources.get(path);
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
		const currentLines = current.split(/(?<=\n)/u);
		const previousLines = previous.split(/(?<=\n)/u);
		const edits = [...diff.matchAll(
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
		const update = {
			path, previousCommit: revision
			, previousSha256: sha256(previous), currentSha256: sha256(current)
			, edits
		};
		assert.equal(reverseRecursiveCheckedRecordPerlDiagnosticUpdate(
			current, update
		), previous);
		return update;
	};
	const updates = [];
	for(const path of recursiveCheckedRecordPerlDiagnosticChangedPaths)
		updates.push(await transition(path));
	await writeFile(inventoryPath, inventoryAfter);
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "recursive-checked-record-perl-diagnostic-source-v1"
		, sourcePredecessorCommit:
			recursiveCheckedRecordPerlDiagnosticSourcePredecessor
		, draftParentCommit: recursiveCheckedRecordPerlDiagnosticDraftParent
		, pinCount, pinSources, updates
	}, null, 2) + "\n";
	await writeFile(recursiveCheckedRecordPerlDiagnosticHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} source transitions and refreshed ${pinCount} pins.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

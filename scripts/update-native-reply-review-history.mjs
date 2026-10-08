/**
 * Record exact Native reply review transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeReplyReviewChangedPaths, nativeReplyReviewHistoryPath, reverseNativeReplyReviewUpdate } from "../tests/helpers/native-reply-review-source-history.mjs";

import { clarifyNativeReplyEvidence, clarifyNativeReplyObservation, nativeReplyReviewObservationIds, nativeReplyReviewValidator } from "../tests/helpers/native-fin-reply-review-notes.mjs";
import { nativeFinReplyPromotionId } from "../tests/helpers/native-fin-reply-promotion-references.mjs";

const predecessorCommit = "f8a1b5daa350f0584c64dd4d2922ae57574bf1aa";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "Native reply review history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nativeReplyReviewHistoryPath]).trim(), "Never rewrite a committed Native reply review ledger");
const inventoryPath = "docs/type-surface.v1.json";
const currentText = await readFile(inventoryPath, "utf8");
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(nativeReplyReviewHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of nativeReplyReviewChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path, "utf8")) });
if(draft)
{
	const update = draft.updates.find(item => item.path === inventoryPath);
	assert.equal(reverseNativeReplyReviewUpdate(currentText, update), git(["show", `${predecessorCommit}:${inventoryPath}`]));
}
else assert.equal(currentText, git(["show", `${predecessorCommit}:${inventoryPath}`]), "Do not overwrite unknown inventory edits");
const inventory = structuredClone(baseline);
let pins = 0;
for(const entry of inventory.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && update.previous !== update.current && file.sha256 === update.previous)
	{
		file.sha256 = update.current; pins++;
	}
}
inventory.observations = inventory.observations.map(item => nativeReplyReviewObservationIds.includes(item.id) ? clarifyNativeReplyObservation(item) : item);
const index = inventory.evidence.findIndex(item => item.id === nativeFinReplyPromotionId);
assert.ok(index >= 0);
inventory.evidence[index] = clarifyNativeReplyEvidence(inventory.evidence[index], sha256(await readFile(nativeReplyReviewValidator)));
const inventoryText = JSON.stringify(inventory, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-reply-review-history-draft-"));
try
{
	const previousPath = join(directory, "previous.json"), currentPath = join(directory, "current.json");
	await writeFile(previousPath, git(["show", `${predecessorCommit}:${inventoryPath}`]));
	await writeFile(currentPath, inventoryText);
	let inventoryDiff;
	try
	{
		inventoryDiff = git(["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		inventoryDiff = error.stdout;
	}
	const updates = [];
	for(const path of nativeReplyReviewChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		// The final history test requires an exact nonempty transition for every declared path.
		if(source === previous) continue;
		const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
		const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
		const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
		assert.equal(reverseNativeReplyReviewUpdate(source, update), previous);
		updates.push(update);
	}
	// Every complete transition is validated before either repository file is written.
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nativeReplyReviewHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "native-reply-review-v1"
		, predecessorCommit, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins with four wording clarifications, one bounded command change and no new coverage.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

/**
 * Record exact Reviewed record promotion transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { reviewedRecordPromotionChangedPaths, reviewedRecordPromotionHistoryPath, reverseReviewedRecordPromotionUpdate } from "../tests/helpers/reviewed-record-promotion-source-history.mjs";

import { reconcileReviewedRecordObservations, reviewedRecordEvidence } from "../tests/helpers/reviewed-record-promotion.mjs";
import { browserGenericCommandQualification, browserGenericEvidenceId } from "../tests/helpers/browser-generic-promotion.mjs";

const predecessorCommit = "6b00a8f929416adf6d85fadce54ec355f6460f0a";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "Reviewed record promotion history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", reviewedRecordPromotionHistoryPath]).trim(), "Never rewrite a committed Reviewed record promotion ledger");
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(reviewedRecordPromotionHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of reviewedRecordPromotionChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path, "utf8")) });
// A rerun may consume only this updater's exact last inventory, never arbitrary edits.
if(draft)
{
	const update = draft.updates.find(item => item.path === inventoryPath);
	assert.equal(sha256(JSON.stringify(inventory, null, 2) + "\n"), update.currentSha256);
}
else assert.deepEqual(inventory, baseline);
const expected = structuredClone(baseline);
let pins = 0;
for(const entry of expected.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous && update.previous !== update.current)
	{ file.sha256 = update.current; pins++; }
}
const browser = expected.evidence.find(entry => entry.id === browserGenericEvidenceId);
assert.ok(browser && !browser.scope.includes(browserGenericCommandQualification));
browser.scope += browserGenericCommandQualification;
expected.evidence.push(...await reviewedRecordEvidence());
expected.observations = reconcileReviewedRecordObservations(baseline.observations);
const inventoryText = JSON.stringify(expected, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-record-promotion-history-draft-"));
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
	const transition = (path, source, previous, diff) => {
		const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
		const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
		const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
		assert.equal(reverseReviewedRecordPromotionUpdate(source, update), previous);
		return update;
	};
	const updates = [];
	for(const path of reviewedRecordPromotionChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		if(source === previous) continue;
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
		updates.push(transition(path, source, previous, diff));
	}
	// Every complete transition is validated before either repository file is written.
	await writeFile(inventoryPath, inventoryText);
	await writeFile(reviewedRecordPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "reviewed-record-promotion-v1"
		, predecessorCommit
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins while extending exactly eight reviewed signature cells.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

/**
 * Record exact Checked-record promotion transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { checkedRecordPromotionChangedPaths, checkedRecordPromotionHistoryPath, reverseCheckedRecordPromotionUpdate } from "../tests/helpers/checked-record-promotion-source-history.mjs";
import { checkedRecordPromotionReferences } from "../tests/helpers/checked-record-promotion-references.mjs";

const predecessorCommit = "fc58deb5ddb1f61040112883da8b6bfee3622f42";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(checkedRecordPromotionHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of checkedRecordPromotionChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path, "utf8")) });
let pins = 0;
for(const [index, entry] of baseline.evidence.entries())
{
	assert.equal(inventory.evidence[index].id, entry.id);
	for(const [position, file] of entry.files.entries())
	{
		const update = sources.get(file.path);
		if(!update || update.previous === update.current || file.sha256 !== update.previous) continue;
		const current = inventory.evidence[index].files[position];
		assert.equal(current.path, file.path);
		const earlier = draft?.updates.find(item => item.path === file.path && item.previousSha256 === update.previous);
		assert.ok([update.previous, update.current, earlier?.currentSha256].includes(current.sha256));
		current.sha256 = update.current; pins++;
	}
}
// New entries belong to this uncommitted promotion, not an older source ledger.
const added = inventory.evidence.slice(baseline.evidence.length);
assert.deepEqual(added.map(item => item.id), (await checkedRecordPromotionReferences()).map(item => item.id));
for(const entry of added) for(const file of entry.files) file.sha256 = sha256(await readFile(file.path));
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${pins} current source pins without changing claims.\n`);
const updates = [];
for(const path of checkedRecordPromotionChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${predecessorCommit}:${path}`]);
	// Bootstrap changed-source pins before generating the new table rows. The final
	// history test requires every declared path to have an exact nonempty transition.
	if(source === previous) continue;
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseCheckedRecordPromotionUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(checkedRecordPromotionHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "checked-record-promotion-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact Checked-record promotion source transitions.\n`);

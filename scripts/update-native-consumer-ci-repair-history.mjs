/**
 * Record exact native consumer CI repair transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeConsumerCiRepairChangedPaths, nativeConsumerCiRepairHistoryPath, reverseNativeConsumerCiRepairUpdate } from "../tests/helpers/native-consumer-ci-repair-source-history.mjs";

const predecessorCommit = "38ea95ab086fb2a9b961d75ca6b06e78b7e7fc10";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(nativeConsumerCiRepairHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of nativeConsumerCiRepairChangedPaths.filter(path => path !== inventoryPath))
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
assert.equal(inventory.evidence.length, baseline.evidence.length);
assert.deepEqual(inventory.observations, baseline.observations);
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Refreshed ${pins} current source pins without changing claims.\n`);
const updates = [];
for(const path of nativeConsumerCiRepairChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${predecessorCommit}:${path}`]);
	// The final history test requires an exact nonempty transition for every declared path.
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
	assert.equal(reverseNativeConsumerCiRepairUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(nativeConsumerCiRepairHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "native-consumer-ci-repair-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact native consumer CI repair source transitions.\n`);

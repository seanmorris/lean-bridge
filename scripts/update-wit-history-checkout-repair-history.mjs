/**
 * Record the WIT workflow comparison repair at its exact predecessor once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { witHistoryCheckoutRepairChangedPaths, witHistoryCheckoutRepairHistoryPath, witHistoryCheckoutRepairPredecessor, reverseWitHistoryCheckoutRepairUpdate } from "../tests/helpers/wit-history-checkout-repair-history.mjs";

const predecessorCommit = witHistoryCheckoutRepairPredecessor;
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "WIT workflow repair history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", witHistoryCheckoutRepairHistoryPath]).trim(), "Never rewrite a committed WIT workflow repair ledger");
for(const path of ["docs/type-surface.v1.json", ".github/workflows/consumer-matrix.yml"])
	assert.equal(await readFile(path, "utf8"), git(["show", `${predecessorCommit}:${path}`]), `${path} must remain unchanged`);
const updates = [];
for(const path of witHistoryCheckoutRepairChangedPaths)
{
	const source = await readFile(path, "utf8");
	const previous = git(["show", `${predecessorCommit}:${path}`]);
	assert.notEqual(source, previous, path);
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv"
		, "--no-color", "--unified=0", predecessorCommit, "--", path]);
	const currentLines = source.split(/(?<=\n)/u);
	const previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseWitHistoryCheckoutRepairUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(witHistoryCheckoutRepairHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "wit-history-checkout-repair-source-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact history repairs; workflow and inventory unchanged.\n`);

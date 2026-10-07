/**
 * Record exact Refinement core follow-up transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { refinementCoreFollowupChangedPaths, refinementCoreFollowupHistoryPath, reverseRefinementCoreFollowupUpdate } from "../tests/helpers/refinement-core-followup-source-history.mjs";

const predecessorCommit = "4f07abddfeb6b7fd2dfa16faefde41f0fdeb8cea";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const updates = [];
for(const path of refinementCoreFollowupChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${predecessorCommit}:${path}`]);
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
	assert.equal(reverseRefinementCoreFollowupUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(refinementCoreFollowupHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "refinement-core-followup-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact Refinement core follow-up source transitions.\n`);

/**
 * Record fresh-Lean omission controls without changing evidence or support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { finRecordOmissionChangedPaths, finRecordOmissionHistoryPath, finRecordOmissionPredecessor, reverseFinRecordOmissionUpdate } from "../tests/helpers/fin-record-review-omission-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), finRecordOmissionPredecessor, "Record review omission history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", finRecordOmissionHistoryPath]).trim(), "Never rewrite a committed record review omission ledger");
const inventoryPath = "docs/type-surface.v1.json";
assert.equal(await readFile(inventoryPath, "utf8"), git(["show", finRecordOmissionPredecessor + ":" + inventoryPath]), "This test-only change must preserve every inventory byte");
const updates = [];
for(const path of finRecordOmissionChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", finRecordOmissionPredecessor + ":" + path]);
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", finRecordOmissionPredecessor, "--", path]);
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseFinRecordOmissionUpdate(source, update), previous);
	updates.push(update);
}
// Every complete source is authenticated before the new ledger is written.
await writeFile(finRecordOmissionHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "fin-record-review-omission-v1"
	, predecessorCommit: finRecordOmissionPredecessor, updates
}, null, 2) + "\n");
process.stdout.write("Recorded " + updates.length + " exact test-only transitions; inventory and older evidence are unchanged.\n");

/**
 * Record the managed gate test repair once, at its exact source predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { managedNominalGateChangedPaths, managedNominalGateHistoryPath, managedNominalGatePredecessor, reverseManagedNominalGateUpdate } from "../tests/helpers/managed-nominal-gate-history.mjs";

const predecessorCommit = managedNominalGatePredecessor;
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "Managed nominal gate history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", managedNominalGateHistoryPath]).trim(), "Never rewrite a committed managed nominal gate ledger");
const inventoryPath = "docs/type-surface.v1.json";
assert.equal(await readFile(inventoryPath, "utf8"), git(["show", `${predecessorCommit}:${inventoryPath}`]), "Support inventory must remain unchanged");
const workflowPath = ".github/workflows/consumer-matrix.yml";
assert.equal(await readFile(workflowPath, "utf8"), git(["show", `${predecessorCommit}:${workflowPath}`]), "The required hosted workflow must remain unchanged");
const updates = [];
for(const path of managedNominalGateChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${predecessorCommit}:${path}`]);
	assert.notEqual(source, previous, path);
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseManagedNominalGateUpdate(source, update), previous); updates.push(update);
}
await writeFile(managedNominalGateHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "managed-nominal-gate-source-v1"
	, predecessorCommit, updates
}, null, 2) + "\n", { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} exact managed gate test transitions; support inventory is unchanged.\n`);

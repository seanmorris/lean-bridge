/**
 * Record the Buffer-reader repair without changing an inventory or older ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { finHistoryBufferRepairChangedPaths, finHistoryBufferRepairHistoryPath, finHistoryBufferRepairPredecessor, reverseFinHistoryBufferRepairUpdate } from "../tests/helpers/fin-history-buffer-repair.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), finHistoryBufferRepairPredecessor, "Fin history Buffer repair is draft-only at its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", finHistoryBufferRepairHistoryPath]).trim(), "", "Never rewrite a committed ledger");
const inventoryPath = "docs/type-surface.v1.json", inventoryBytes = await readFile(inventoryPath);
assert.equal(inventoryBytes.toString(), git(["show", `${finHistoryBufferRepairPredecessor}:${inventoryPath}`]));
const inventory = JSON.parse(inventoryBytes);
assert.equal(inventory.evidence.flatMap(entry => entry.files).filter(file => finHistoryBufferRepairChangedPaths.includes(file.path)).length, 0, "This repair must not change any current evidence pin");
const updates = [];
for(const path of finHistoryBufferRepairChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${finHistoryBufferRepairPredecessor}:${path}`]);
	assert.notEqual(source, previous, path);
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", finHistoryBufferRepairPredecessor, "--", path]);
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
	assert.equal(reverseFinHistoryBufferRepairUpdate(source, update), previous);
	updates.push(update);
}
const reproduction = await readFile("build/vo1220-perl-history-repro-r1.tap");
assert.equal(sha256(reproduction), "abb42414c2e4e4b9fa5105fcba9b564c2d629dcb14e558250c70ceb98d651f1c");
const reproductionPath = "docs/evidence/fin-history-buffer-repair-20261010/local-reproduction.tap";
const ledger = {
	schemaVersion: 1
	, milestone: "fin-history-buffer-repair-v1"
	, predecessorCommit: finHistoryBufferRepairPredecessor
	, inventorySha256: sha256(inventoryBytes), updates
	, reproduction: { path: reproductionPath, bytes: reproduction.length, sha256: sha256(reproduction) }
};
// No repository writes occur until every source transition and original TAP is checked.
await mkdir(dirname(reproductionPath), { recursive: false });
await writeFile(reproductionPath, reproduction, { flag: "wx" });
await writeFile(finHistoryBufferRepairHistoryPath, JSON.stringify(ledger, null, 2) + "\n", { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} exact test-source transitions; inventory and older evidence unchanged.\n`);

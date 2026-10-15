/**
 * Record the exact C# test transition of the producer load ceilings while preserving every older ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { nominalSubtypeDotnetCeilingChangedPaths, nominalSubtypeDotnetCeilingHistoryPath, nominalSubtypeDotnetCeilingPredecessor, reverseNominalSubtypeDotnetCeilingUpdate } from "../tests/helpers/nominal-subtype-dotnet-ceiling-history.mjs";
const predecessorCommit = nominalSubtypeDotnetCeilingPredecessor;
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "C# ceiling history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nominalSubtypeDotnetCeilingHistoryPath]).trim(), "Never rewrite a committed C# ceiling ledger");
const inventoryPath = "docs/type-surface.v1.json";
assert.equal(await readFile(inventoryPath, "utf8"), git(["show", `${predecessorCommit}:${inventoryPath}`]), "Support inventory must remain unchanged");
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
	assert.equal(reverseNominalSubtypeDotnetCeilingUpdate(source, update), previous);
	return update;
};
const updates = [];
for(const path of nominalSubtypeDotnetCeilingChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${predecessorCommit}:${path}`]);
	assert.notEqual(source, previous, path);
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
	updates.push(transition(path, source, previous, diff));
}
await writeFile(nominalSubtypeDotnetCeilingHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "nominal-subtype-dotnet-ceiling-source-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact C# ceiling transitions; support inventory is unchanged.\n`);

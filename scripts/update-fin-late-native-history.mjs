/**
 * Record exact additive Fin late-input transitions at their frozen predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { finLateChangedPaths, finLateHistoryPath, finLatePredecessor, reverseFinLateUpdate } from "../tests/helpers/fin-container-late-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), finLatePredecessor, "Late-input history is draft-only at its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", finLateHistoryPath]), "", "Never rewrite a committed ledger");
const inventory = await readFile("docs/type-surface.v1.json", "utf8");
assert.equal(inventory, git(["show", "HEAD:docs/type-surface.v1.json"]), "Late-input source work must not change support claims");
for(const file of JSON.parse(inventory).evidence.flatMap(item => item.files))
	assert.ok(!finLateChangedPaths.includes(file.path), "A live source pin requires a separate recorded refresh");
const updates = [];
for(const path of finLateChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", `${finLatePredecessor}:${path}`]);
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", finLatePredecessor, "--", path]);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseFinLateUpdate(source, update), previous); updates.push(update);
}
await writeFile(finLateHistoryPath, JSON.stringify({ schemaVersion: 1, milestone: "fin-container-late-native-source-v1", predecessorCommit: finLatePredecessor, updates }, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact transitions; support inventory unchanged.\n`);

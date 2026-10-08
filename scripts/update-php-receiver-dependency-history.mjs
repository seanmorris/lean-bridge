/**
 * Record exact PHP-Wasm receiver dependency transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { phpReceiverDependencyChangedPaths, phpReceiverDependencyHistoryPath, reversePhpReceiverDependencyUpdate } from "../tests/helpers/php-receiver-dependency-source-history.mjs";

const predecessorCommit = "c391e58a1fcfa9a3c137f1ca4b4fb8a49fc77dda";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const updates = [];
for(const path of phpReceiverDependencyChangedPaths)
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
	assert.equal(reversePhpReceiverDependencyUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(phpReceiverDependencyHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "php-receiver-dependency-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact PHP-Wasm receiver dependency source transitions.\n`);

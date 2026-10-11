/**
 * Record the test-only Checked-record PHP-Wasm archive repair against its exact Git predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { checkedRecordPhpWasmArchiveChangedPaths, checkedRecordPhpWasmArchiveHistoryPath, checkedRecordPhpWasmArchivePredecessor, reverseCheckedRecordPhpWasmArchiveUpdate } from "../tests/helpers/checked-record-php-wasm-archive-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), checkedRecordPhpWasmArchivePredecessor, "Checked-record PHP-Wasm archive history is draft-only at its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", checkedRecordPhpWasmArchiveHistoryPath]).trim(), "", "Never rewrite a committed ledger");
const original = path => git(["show", `${checkedRecordPhpWasmArchivePredecessor}:${path}`]);
assert.equal(await readFile("docs/type-surface.v1.json", "utf8"), original("docs/type-surface.v1.json"));
const updates = [];
for(const path of checkedRecordPhpWasmArchiveChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = original(path);
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", checkedRecordPhpWasmArchivePredecessor, "--", path]);
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
	assert.equal(reverseCheckedRecordPhpWasmArchiveUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(checkedRecordPhpWasmArchiveHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "checked-record-php-wasm-archive-v1"
	, predecessorCommit: checkedRecordPhpWasmArchivePredecessor, updates
}, null, 2) + "\n");
process.stdout.write(`Recorded ${updates.length} exact test-source transitions; inventory bytes unchanged.\n`);

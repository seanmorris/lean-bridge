/**
 * Record four exact test/registration transitions without altering support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { structuralSubtypeCiFoundationChangedPaths, structuralSubtypeCiFoundationHistoryPath, structuralSubtypeCiFoundationPredecessor, reverseStructuralSubtypeCiFoundationUpdate } from "../tests/helpers/structural-subtype-ci-foundation-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const predecessorCommit = structuralSubtypeCiFoundationPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "structural CI foundation history is draft-only at its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", structuralSubtypeCiFoundationHistoryPath]).trim(), "Never rewrite a committed ledger");
assert.equal(await readFile("docs/type-surface.v1.json", "utf8"), git(["show", predecessorCommit + ":docs/type-surface.v1.json"]), "This test-only milestone must not alter inventory");
const updates = [];
for(const path of structuralSubtypeCiFoundationChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", predecessorCommit + ":" + path]);
	assert.notEqual(source, previous, path);
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
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
	assert.equal(reverseStructuralSubtypeCiFoundationUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(structuralSubtypeCiFoundationHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "structural-subtype-ci-foundation-source-v1"
	, predecessorCommit, updates
}, null, 2) + "\n");
process.stdout.write("Recorded " + updates.length + " exact source transitions; all support claims and pins are unchanged.\n");

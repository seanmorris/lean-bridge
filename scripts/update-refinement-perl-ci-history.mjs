/**
 * Record this assertion repair's exact source transitions at its frozen predecessor only.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { refinementPerlCiChangedPaths, refinementPerlCiHistoryPath, refinementPerlCiPredecessor, reverseRefinementPerlCiUpdate } from "../tests/helpers/refinement-perl-ci-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), refinementPerlCiPredecessor, "Perl CI assertion history is draft-only at its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", refinementPerlCiHistoryPath]).trim(), "Never rewrite a committed ledger");
await assert.rejects(access(refinementPerlCiHistoryPath), { code: "ENOENT" });
assert.equal(await readFile("docs/type-surface.v1.json", "utf8"), git(["show", `${refinementPerlCiPredecessor}:docs/type-surface.v1.json`]));
const updates = [];
for(const path of refinementPerlCiChangedPaths)
{
	const previous = git(["show", `${refinementPerlCiPredecessor}:${path}`]), current = await readFile(path, "utf8");
	const diff = git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", refinementPerlCiPredecessor, "--", path]);
	const currentLines = current.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(current), previousSha256: sha256(previous), edits };
	assert.equal(reverseRefinementPerlCiUpdate(current, update), previous); updates.push(update);
}
await writeFile(refinementPerlCiHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "refinement-perl-ci-v1"
	, predecessorCommit: refinementPerlCiPredecessor, updates
}, null, 2) + "\n", { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} exact transitions; inventory and older ledgers unchanged.\n`);

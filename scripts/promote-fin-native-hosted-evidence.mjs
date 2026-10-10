/**
 * Apply the authenticated hosted Fin inventory and record exact predecessor transitions.
 * Draft-only at the preparation commit; never rewrite a committed ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { finHostedPromotionReferences } from "../tests/helpers/fin-native-hosted-promotion-references.mjs";
import { promoteFinHostedCoverage } from "../tests/helpers/fin-native-hosted-promotion.mjs";
import { finHostedPromotionChangedPaths, finHostedPromotionHistoryPath, finHostedPromotionPredecessor, reverseFinHostedPromotionUpdate } from "../tests/helpers/fin-native-hosted-promotion-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), finHostedPromotionPredecessor, "Hosted Fin promotion history is draft-only at its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", finHostedPromotionHistoryPath]).trim(), "Never rewrite a committed hosted Fin promotion ledger");
const inventoryPath = "docs/type-surface.v1.json";
const baselineText = git(["show", finHostedPromotionPredecessor + ":" + inventoryPath]);
const baseline = JSON.parse(baselineText), candidateText = await readFile(inventoryPath, "utf8");
const candidate = JSON.parse(candidateText);
const expected = await promoteFinHostedCoverage(baseline, await finHostedPromotionReferences());
const sources = new Map();
for(const path of finHostedPromotionChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", finHostedPromotionPredecessor + ":" + path])), current: sha256(await readFile(path)) });
const draft = await readFile(finHostedPromotionHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, finHostedPromotionPredecessor);
let refreshed = 0;
for(const entry of expected.evidence.slice(0, baseline.evidence.length)) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous)
	{ file.sha256 = update.current; refreshed++; }
}
if(candidateText !== baselineText)
{
	for(const [index, entry] of candidate.evidence.entries()) for(const [position, file] of entry.files.entries())
	{
		const update = sources.get(file.path);
		if(!update) continue;
		const earlier = draft?.updates.find(item => item.path === file.path);
		assert.ok([update.previous, update.current, earlier?.currentSha256].includes(file.sha256), file.path);
		const target = expected.evidence[index]?.files[position];
		assert.equal(target?.path, file.path);
		file.sha256 = target.sha256;
	}
	assert.deepEqual(candidate, expected, "Only the reviewed promotion and authenticated current-source pin refresh may change");
}
await writeFile(inventoryPath, JSON.stringify(expected, null, 2) + "\n");
const updates = [];
for(const path of finHostedPromotionChangedPaths)
{
	const source = await readFile(path, "utf8"), previous = git(["show", finHostedPromotionPredecessor + ":" + path]);
	const diff = git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", finHostedPromotionPredecessor, "--", path]);
	const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
		const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
	});
	const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
	assert.equal(reverseFinHostedPromotionUpdate(source, update), previous);
	updates.push(update);
}
await writeFile(finHostedPromotionHistoryPath, JSON.stringify({
	schemaVersion: 1, milestone: "fin-native-hosted-promotion-v1"
	, predecessorCommit: finHostedPromotionPredecessor, updates
}, null, 2) + "\n");
process.stdout.write("Promoted 78 hosted reports, supplemented 31 observations, added eight field cells, refreshed "
	+ refreshed + " source pins and recorded " + updates.length + " exact transitions.\n");

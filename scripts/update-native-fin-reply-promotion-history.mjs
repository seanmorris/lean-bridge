/**
 * Record exact native Fin reply promotion transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { nativeFinReplyPromotionChangedPaths, nativeFinReplyPromotionHistoryPath, reverseNativeFinReplyPromotionUpdate } from "../tests/helpers/native-fin-reply-promotion-source-history.mjs";

import { nativeFinReplyPromotionId, nativeFinReplyPromotionObservation, nativeFinReplyPromotionObservationIds, nativeFinReplyPromotionReference, nativeFinReplyPromotionValidators } from "../tests/helpers/native-fin-reply-promotion-references.mjs";

const predecessorCommit = "ffb7a4478f00a72983d2e8863e73bb0d01e94d9f";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "Native Fin reply promotion history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nativeFinReplyPromotionHistoryPath]).trim(), "Never rewrite a committed native Fin reply ledger");
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(nativeFinReplyPromotionHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of nativeFinReplyPromotionChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path, "utf8")) });
let pins = 0;
for(const [index, entry] of baseline.evidence.entries())
{
	assert.equal(inventory.evidence[index].id, entry.id);
	for(const [position, file] of entry.files.entries())
	{
		const update = sources.get(file.path);
		if(!update || update.previous === update.current || file.sha256 !== update.previous) continue;
		const current = inventory.evidence[index].files[position];
		assert.equal(current.path, file.path);
		const earlier = draft?.updates.find(item => item.path === file.path && item.previousSha256 === update.previous);
		assert.ok([update.previous, update.current, earlier?.currentSha256].includes(current.sha256));
		current.sha256 = update.current; pins++;
	}
}
assert.equal(inventory.evidence.length, baseline.evidence.length + 1);
assert.equal(inventory.evidence.at(-1).id, nativeFinReplyPromotionId);
for(const file of inventory.evidence.at(-1).files) file.sha256 = sha256(await readFile(file.path));
const expected = structuredClone(baseline);
for(const entry of expected.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous) file.sha256 = update.current;
}
expected.observations = expected.observations.map(item => nativeFinReplyPromotionObservationIds.includes(item.id) ? nativeFinReplyPromotionObservation(item) : item);
const reference = await nativeFinReplyPromotionReference();
expected.evidence.push({ id: reference.id, kind: "installed"
	, revision: reference.revision, command: reference.command
	, scope: reference.scope
	, files: await Promise.all([...nativeFinReplyPromotionValidators, ...reference.files.map(file => file.path)].map(async path => ({ path, sha256: sha256(await readFile(path)) })))
	, artifacts: reference.artifacts });
assert.deepEqual(inventory, expected, "Only the two reconciled observations, one installed receipt and exact old source pins may change");
const inventoryText = JSON.stringify(inventory, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reply-history-draft-"));
try
{
	const previousPath = join(directory, "previous.json"), currentPath = join(directory, "current.json");
	await writeFile(previousPath, git(["show", `${predecessorCommit}:${inventoryPath}`]));
	await writeFile(currentPath, inventoryText);
	let inventoryDiff;
	try
	{
		inventoryDiff = git(["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		inventoryDiff = error.stdout;
	}
	const updates = [];
	for(const path of nativeFinReplyPromotionChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		// The final history test requires an exact nonempty transition for every declared path.
		if(source === previous) continue;
		const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
		const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
		const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
		assert.equal(reverseNativeFinReplyPromotionUpdate(source, update), previous);
		updates.push(update);
	}
	// Every complete transition is validated before either repository file is written.
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nativeFinReplyPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "native-fin-reply-promotion-v1"
		, predecessorCommit, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins; reconciled only two ordinary callback observations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

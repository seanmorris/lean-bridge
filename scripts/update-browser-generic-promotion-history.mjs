/**
 * Record exact Browser generic promotion transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { browserGenericEvidence, browserGenericObservation } from "../tests/helpers/browser-generic-promotion.mjs";
import { browserGenericPromotionChangedPaths, browserGenericPromotionHistoryPath, reverseBrowserGenericPromotionUpdate } from "../tests/helpers/browser-generic-promotion-source-history.mjs";

const predecessorCommit = "9eb39058caa2529edaed6f87f2f3989204294e80";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit, "Browser generic promotion history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", browserGenericPromotionHistoryPath]).trim(), "Never rewrite a committed Browser generic promotion ledger");
const inventoryPath = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(browserGenericPromotionHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of browserGenericPromotionChangedPaths.filter(path => path !== inventoryPath))
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
assert.deepEqual(inventory.observations.slice(0, baseline.observations.length), baseline.observations);
const expected = structuredClone(baseline);
for(const entry of expected.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous) file.sha256 = update.current;
}
// Replace only this draft's two appended records, preserving all earlier claims.
assert.deepEqual(inventory.evidence.slice(baseline.evidence.length).map(entry => entry.id),
	inventory.evidence.length === baseline.evidence.length ? [] : ["browser-generic-specializations-ordinary-installed"]);
assert.deepEqual(inventory.observations.slice(baseline.observations.length),
	inventory.observations.length === baseline.observations.length ? [] : [browserGenericObservation()]);
inventory.evidence = [...inventory.evidence.slice(0, baseline.evidence.length), await browserGenericEvidence()];
inventory.observations = [...baseline.observations, browserGenericObservation()];
expected.evidence.push(inventory.evidence.at(-1));
expected.observations.push(inventory.observations.at(-1));
assert.deepEqual(inventory, expected, "Preserve every earlier observation and evidence claim except exact source pins");
const inventoryText = JSON.stringify(inventory, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-browser-generic-promotion-history-draft-"));
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
		assert.equal(reverseBrowserGenericPromotionUpdate(source, update), previous);
		return update;
	};
	const updates = [];
	for(const path of browserGenericPromotionChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		if(source === previous) continue;
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
		updates.push(transition(path, source, previous, diff));
	}
	// Every complete transition is validated before either repository file is written.
	await writeFile(inventoryPath, inventoryText);
	await writeFile(browserGenericPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "browser-generic-promotion-v1"
		, predecessorCommit
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins with six ordinary browser signature cells.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

/**
 * Record the exact Core quality budget transition without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { coreQualityBudgetChangedPaths, coreQualityBudgetHistoryPath, coreQualityBudgetPredecessor, reverseCoreQualityBudgetUpdate } from "../tests/helpers/core-quality-budget-history.mjs";

const predecessorCommit = coreQualityBudgetPredecessor;
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessorCommit
	, "Core quality budget history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", coreQualityBudgetHistoryPath]).trim()
	, "Never rewrite a committed Core quality budget ledger");
const inventoryPath = "docs/type-surface.v1.json";
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
const draft = await readFile(coreQualityBudgetHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of coreQualityBudgetChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path, "utf8")) });
const existingText = await readFile(inventoryPath, "utf8");
const prior = draft?.updates.find(item => item.path === inventoryPath);
const restored = prior?.currentSha256 === sha256(existingText)
	? reverseCoreQualityBudgetUpdate(existingText, prior) : existingText;
assert.deepEqual(JSON.parse(restored), baseline, "Never overwrite unrecorded inventory changes");
const repaired = structuredClone(baseline);
let pins = 0;
for(const collection of [repaired.evidence, repaired.observations]) for(const entry of collection) for(const file of entry.files ?? [])
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous && update.previous !== update.current)
	{ file.sha256 = update.current; pins++; }
}
assert.equal(pins, 4, "Refresh exactly the four existing source pins and no support claims");
const inventoryText = JSON.stringify(repaired, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-core-quality-budget-history-draft-"));
try
{
	const previousPath = join(directory, "previous.json"), currentPath = join(directory, "current.json");
	await writeFile(previousPath, git(["show", `${predecessorCommit}:${inventoryPath}`]));
	await writeFile(currentPath, inventoryText);
	let inventoryDiff;
	try
	{
		inventoryDiff = git(["diff", "--histogram", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]);
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
		assert.equal(reverseCoreQualityBudgetUpdate(source, update), previous);
		return update;
	};
	const updates = [];
	for(const path of coreQualityBudgetChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		if(source === previous) continue;
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
		updates.push(transition(path, source, previous, diff));
	}
	assert.deepEqual(updates.map(update => update.path), coreQualityBudgetChangedPaths);
	await writeFile(inventoryPath, inventoryText);
	await writeFile(coreQualityBudgetHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "core-quality-budget-source-v1"
		, predecessorCommit, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins; support claims are unchanged.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

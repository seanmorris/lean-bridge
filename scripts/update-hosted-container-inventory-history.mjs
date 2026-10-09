/**
 * Generate the bounded hosted container inventory supplement and exact predecessor ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { hostedContainerInventoryChangedPaths, hostedContainerInventoryHistoryPath, hostedContainerInventoryPredecessor, reverseHostedContainerInventoryUpdate } from "../tests/helpers/hosted-container-inventory-source-history.mjs";
import { hostedContainerReferences, supplementHostedContainerInventory } from "../tests/helpers/hosted-container-inventory.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const predecessor = hostedContainerInventoryPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor, "Hosted container inventory history is draft-only at its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", hostedContainerInventoryHistoryPath]).trim(), "Never rewrite a committed hosted container inventory ledger");
const inventoryPath = "docs/type-surface.v1.json", baselineText = git(["show", `${predecessor}:${inventoryPath}`]);
const currentText = await readFile(inventoryPath, "utf8");
const draft = await readFile(hostedContainerInventoryHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.predecessorCommit, predecessor);
	assert.equal(reverseHostedContainerInventoryUpdate(currentText, draft.updates.find(item => item.path === inventoryPath)), baselineText);
}
else assert.equal(currentText, baselineText, "Never discard an unrelated inventory edit");
const baseline = JSON.parse(baselineText);
const inventory = await supplementHostedContainerInventory(baseline, await hostedContainerReferences());
const sources = new Map();
for(const path of hostedContainerInventoryChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessor}:${path}`])), current: sha256(await readFile(path)) });
let pins = 0;
for(const entry of inventory.evidence.slice(0, baseline.evidence.length)) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && update.previous !== update.current && file.sha256 === update.previous)
	{ file.sha256 = update.current; pins++; }
}
const inventoryText = JSON.stringify(inventory, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-hosted-container-inventory-history-draft-"));
try
{
	const previousPath = join(directory, "previous.json"), currentPath = join(directory, "current.json");
	await writeFile(previousPath, baselineText); await writeFile(currentPath, inventoryText);
	let inventoryDiff;
	try
	{ inventoryDiff = git(["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", previousPath, currentPath]); }
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		inventoryDiff = error.stdout;
	}
	const updates = [];
	for(const path of hostedContainerInventoryChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8"), previous = git(["show", `${predecessor}:${path}`]);
		assert.notEqual(source, previous, `Every registered transition must change: ${path}`);
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessor, "--", path]);
		const currentLines = source.split(/(?<=\n)/u), previousLines = previous.split(/(?<=\n)/u);
		const edits = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)].map(match => {
			const previousCount = Number(match[2] ?? 1), currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0), currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return { start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart, currentStart + currentCount).join("") };
		});
		const update = { path, currentSha256: sha256(source), previousSha256: sha256(previous), edits };
		assert.equal(reverseHostedContainerInventoryUpdate(source, update), previous);
		updates.push(update);
	}
	// Validate every reversal before writing either generated repository file.
	await writeFile(inventoryPath, inventoryText);
	await writeFile(hostedContainerInventoryHistoryPath, JSON.stringify({ schemaVersion: 1
		, milestone: "hosted-container-inventory-v1"
		, predecessorCommit: predecessor, updates }, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact transitions, refreshed ${pins} old source pins and added four hosted container selections.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

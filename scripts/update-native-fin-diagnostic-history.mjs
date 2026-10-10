/**
 * Record exact native Fin diagnostic transitions without rewriting older ledgers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { finDiagnosticChangedPaths, finDiagnosticHistoryPath, reverseFinDiagnosticUpdate } from "../tests/helpers/native-fin-diagnostic-source-history.mjs";


const predecessorCommit = "5ba49f93ad5226a876b40057f436e265307f8323";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), "ee57927b29d231039c032d93c0a988d198d25209", "Native Fin diagnostic history is draft-only at its exact predecessor; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", finDiagnosticHistoryPath]).trim(), "Never rewrite a committed native Fin diagnostic ledger");
const inventoryPath = "docs/type-surface.v1.json";
const existingText = await readFile(inventoryPath, "utf8");
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
// Permit a previous draft of this same new ledger while the milestone is being prepared.
const draft = await readFile(finDiagnosticHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of finDiagnosticChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`]))
		, current: sha256(await readFile(path, "utf8")) });
// Accept only the exact baseline or this milestone's authenticated previous draft.
const prior = draft?.updates.find(item => item.path === inventoryPath);
const restored = prior?.currentSha256 === sha256(existingText)
	? reverseFinDiagnosticUpdate(existingText, prior) : existingText;
assert.deepEqual(JSON.parse(restored), baseline, "Never overwrite unrecorded inventory changes");
const inventory = structuredClone(baseline);
let pins = 0;
for(const entry of inventory.evidence.slice(0, baseline.evidence.length)) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous && update.previous !== update.current)
	{ file.sha256 = update.current; pins++; }
}
const inventoryText = JSON.stringify(inventory, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-fin-diagnostic-history-draft-"));
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
		assert.equal(reverseFinDiagnosticUpdate(source, update), previous);
		return update;
	};
	const updates = [];
	for(const path of finDiagnosticChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		if(source === previous) continue;
		const diff = path === inventoryPath ? inventoryDiff : git(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", predecessorCommit, "--", path]);
		updates.push(transition(path, source, previous, diff));
	}
	// Every complete transition is validated before either repository file is written.
	await writeFile(inventoryPath, inventoryText);
	await writeFile(finDiagnosticHistoryPath, JSON.stringify({
		schemaVersion: 1, milestone: "native-fin-diagnostics-v1"
		, predecessorCommit
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} old source pins; changed no support claims or evidence entries.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }

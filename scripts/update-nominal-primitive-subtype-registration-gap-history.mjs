#!/usr/bin/env node
/**
 * Record the two historical primitive-base aggregator registration gaps from exact Git blobs,
 * plus this repair's own source transitions and refreshed inventory pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypeRegistrationGapChangedPaths
	, nominalPrimitiveSubtypeRegistrationGapDraftParent
	, nominalPrimitiveSubtypeRegistrationGapHistoryPath
	, nominalPrimitiveSubtypeRegistrationGapPath
	, nominalPrimitiveSubtypeRegistrationGapPredecessor
	, nominalPrimitiveSubtypeRegistrationGaps
	, reverseNominalPrimitiveSubtypeRegistrationGapUpdate
} from "../tests/helpers/nominal-primitive-subtype-registration-gap-history.mjs";

const predecessorCommit = nominalPrimitiveSubtypeRegistrationGapPredecessor;
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), nominalPrimitiveSubtypeRegistrationGapDraftParent
	, "primitive-base registration gap history is draft-only at its exact draft parent; never rewrite a committed ledger");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", nominalPrimitiveSubtypeRegistrationGapHistoryPath]).trim()
	, "Never rewrite a committed primitive-base registration gap ledger");

/**
 * Turn a unified zero-context diff into exact reversible edits.
 *
 * @param path - Repository-relative path.
 * @param source - Later complete text.
 * @param previous - Earlier complete text.
 * @param diff - Unified diff from earlier to later with zero context.
 */
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
	assert.equal(reverseNominalPrimitiveSubtypeRegistrationGapUpdate(source, update), previous);
	return update;
};
const zeroContext = (from, to) => ["diff", "--histogram", "--no-ext-diff", "--no-textconv", "--no-color", "--unified=0", from, ...to ? [to] : []];

const gaps = {};
for(const [name, [from, to]] of Object.entries(nominalPrimitiveSubtypeRegistrationGaps))
{
	const path = nominalPrimitiveSubtypeRegistrationGapPath;
	const previous = git(["show", `${from}:${path}`]), current = git(["show", `${to}:${path}`]);
	assert.notEqual(previous, current);
	const diff = git([...zeroContext(from, to), "--", path]);
	const fromCommit = git(["rev-parse", from]).trim(), toCommit = git(["rev-parse", to]).trim();
	gaps[name] = { ...transition(path, current, previous, diff), fromCommit, toCommit };
}

const inventoryPath = "docs/type-surface.v1.json";
const baseline = JSON.parse(git(["show", `${predecessorCommit}:${inventoryPath}`]));
const draft = await readFile(nominalPrimitiveSubtypeRegistrationGapHistoryPath, "utf8").then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft) assert.equal(draft.predecessorCommit, predecessorCommit);
const sources = new Map();
for(const path of nominalPrimitiveSubtypeRegistrationGapChangedPaths.filter(path => path !== inventoryPath))
	sources.set(path, { previous: sha256(git(["show", `${predecessorCommit}:${path}`])), current: sha256(await readFile(path, "utf8")) });
const existingText = await readFile(inventoryPath, "utf8");
const prior = draft?.updates.find(item => item.path === inventoryPath);
const restored = prior?.currentSha256 === sha256(existingText) ? reverseNominalPrimitiveSubtypeRegistrationGapUpdate(existingText, prior) : existingText;
assert.equal(JSON.stringify(JSON.parse(restored)), JSON.stringify(baseline), "Never overwrite unrecorded inventory changes");
// This repair adds no receipts or cells; it only refreshes pins of its own changed sources.
const repaired = structuredClone(baseline);
let pins = 0;
for(const entry of repaired.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && file.sha256 === update.previous && update.previous !== update.current)
	{ file.sha256 = update.current; pins++; }
}
const inventoryText = JSON.stringify(repaired, null, 2) + "\n";
const directory = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-registration-gap-history-draft-"));
try
{
	const previousPath = join(directory, "previous.json"), currentPath = join(directory, "current.json");
	await writeFile(previousPath, git(["show", `${predecessorCommit}:${inventoryPath}`]));
	await writeFile(currentPath, inventoryText);
	let inventoryDiff;
	try
	{ inventoryDiff = execFileSync("diff", ["--speed-large-files", "--unified=0", previousPath, currentPath], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); }
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		inventoryDiff = error.stdout;
	}
	const updates = [];
	for(const path of nominalPrimitiveSubtypeRegistrationGapChangedPaths)
	{
		const source = path === inventoryPath ? inventoryText : await readFile(path, "utf8");
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		if(source === previous) continue;
		const diff = path === inventoryPath ? inventoryDiff : git([...zeroContext(predecessorCommit), "--", path]);
		updates.push(transition(path, source, previous, diff));
	}
	assert.deepEqual(updates.map(update => update.path), nominalPrimitiveSubtypeRegistrationGapChangedPaths);
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nominalPrimitiveSubtypeRegistrationGapHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "nominal-primitive-subtype-registration-gap-source-v1"
		, predecessorCommit
		, draftParentCommit: nominalPrimitiveSubtypeRegistrationGapDraftParent
		, gaps, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${Object.keys(gaps).length} historical registration gaps and ${updates.length} exact source transitions; refreshed ${pins} source pins.\n`);
}
finally
{ await rm(directory, { recursive: true }); }

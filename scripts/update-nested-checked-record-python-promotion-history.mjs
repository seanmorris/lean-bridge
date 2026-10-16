#!/usr/bin/env node
/**
 * Record the nested checked-record Python promotion at its exact parent.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import {
	nestedCheckedRecordPythonReferences
	, promoteNestedCheckedRecordPython
} from "../tests/helpers/nested-checked-record-python-promotion.mjs";
import {
	nestedCheckedRecordPythonPromotionChangedPaths
	, nestedCheckedRecordPythonPromotionDraftParent
	, nestedCheckedRecordPythonPromotionHistoryPath
	, nestedCheckedRecordPythonPromotionPredecessor
	, reverseNestedCheckedRecordPythonPromotionUpdate
} from "../tests/helpers/nested-checked-record-python-promotion-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nestedCheckedRecordPythonPromotionDraftParent
	, "nested checked-record Python promotion history is draft-only at its exact parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, nestedCheckedRecordPythonPromotionHistoryPath]).trim()
, "Never rewrite a committed nested checked-record Python ledger");

const inventoryPath = "docs/type-surface.v1.json";
const baselineText = git(["show"
	, `${nestedCheckedRecordPythonPromotionPredecessor}:${inventoryPath}`]);
const baseline = JSON.parse(baselineText);
const draft = await readFile(
	nestedCheckedRecordPythonPromotionHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
	assert.equal(draft.predecessorCommit
		, nestedCheckedRecordPythonPromotionPredecessor);

const existingText = await readFile(inventoryPath, "utf8");
const prior = draft?.updates.find(item => item.path === inventoryPath);
const restored = prior?.currentSha256 === sha256(existingText)
	? reverseNestedCheckedRecordPythonPromotionUpdate(existingText, prior)
	: existingText;
assert.equal(restored, baselineText, "Never overwrite unrecorded inventory changes");

const promoted = await promoteNestedCheckedRecordPython(
	baseline, await nestedCheckedRecordPythonReferences()
);
const preliminarySources = new Map();
for(const path of nestedCheckedRecordPythonPromotionChangedPaths
	.filter(path => path !== inventoryPath)) {
	const previous = git(["show"
		, `${nestedCheckedRecordPythonPromotionPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	preliminarySources.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
	}
const refreshedPins = new Set();
for(const entry of promoted.evidence) for(const file of entry.files)
{
	const update = preliminarySources.get(file.path);
	if(update && update.previous !== update.current
		&& file.sha256 === update.previous) {
		file.sha256 = update.current; refreshedPins.add(file);
		}
}
await writeFile(inventoryPath, JSON.stringify(promoted, null, 2) + "\n");
try
{
	await generateReferenceDocs({ root: process.cwd(), write: true });
}
finally
{
	await writeFile(inventoryPath, existingText);
}
const sources = new Map();
for(const path of nestedCheckedRecordPythonPromotionChangedPaths
	.filter(path => path !== inventoryPath)) {
	const previous = git(["show"
		, `${nestedCheckedRecordPythonPromotionPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, {
		previous: sha256(previous)
		, preliminary: preliminarySources.get(path).current
		, current: sha256(current)
	});
	}
for(const entry of promoted.evidence) for(const file of entry.files)
{
	const update = sources.get(file.path);
	if(update && update.current !== file.sha256
		&& [update.previous, update.preliminary].includes(file.sha256)) {
		file.sha256 = update.current; refreshedPins.add(file);
		}
}
const inventoryText = JSON.stringify(promoted, null, 2) + "\n";
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-nested-record-python-promotion-history-draft-"
));
try
{
	const transition = async path => {
		const source = path === inventoryPath
			? inventoryText : await readFile(path, "utf8");
		const previous = git(["show"
			, `${nestedCheckedRecordPythonPromotionPredecessor}:${path}`]);
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, source);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const currentLines = source.split(/(?<=\n)/u);
		const previousLines = previous.split(/(?<=\n)/u);
		const edits = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
		const update = {
			path, previousSha256: sha256(previous)
			, currentSha256: sha256(source), edits
		};
		assert.equal(reverseNestedCheckedRecordPythonPromotionUpdate(source, update)
			, previous);
		return update;
	};
	const updates = [];
	for(const path of nestedCheckedRecordPythonPromotionChangedPaths)
		updates.push(await transition(path));
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nestedCheckedRecordPythonPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "nested-checked-record-python-promotion-source-v1"
		, predecessorCommit: nestedCheckedRecordPythonPromotionPredecessor
		, draftParentCommit: nestedCheckedRecordPythonPromotionDraftParent
		, pinCount: refreshedPins.size, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${refreshedPins.size} source pins; added four evidence entries and supplemented six Python cells.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

#!/usr/bin/env node
/**
 * Record the nested checked-record C# promotion once at its exact parent.
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
	nestedCheckedRecordDotnetReferences, promoteNestedCheckedRecordDotnet
} from "../tests/helpers/nested-checked-record-dotnet-promotion.mjs";
import {
	nestedCheckedRecordDotnetPromotionChangedPaths
	, nestedCheckedRecordDotnetPromotionDraftParent
	, nestedCheckedRecordDotnetPromotionHistoryPath
	, nestedCheckedRecordDotnetPromotionPredecessor
	, reverseNestedCheckedRecordDotnetPromotionUpdate
} from "../tests/helpers/nested-checked-record-dotnet-promotion-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nestedCheckedRecordDotnetPromotionDraftParent
	, "nested checked-record C# promotion history is draft-only at its exact parent");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--"
	, nestedCheckedRecordDotnetPromotionHistoryPath]).trim()
, "Never rewrite a committed nested checked-record C# promotion ledger");

const inventoryPath = "docs/type-surface.v1.json";
const baselineText = git(["show"
	, `${nestedCheckedRecordDotnetPromotionPredecessor}:${inventoryPath}`]);
const baseline = JSON.parse(baselineText);
const draft = await readFile(
	nestedCheckedRecordDotnetPromotionHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
	assert.equal(draft.predecessorCommit
		, nestedCheckedRecordDotnetPromotionPredecessor);

const existingText = await readFile(inventoryPath, "utf8");
const prior = draft?.updates.find(item => item.path === inventoryPath);
const restored = prior?.currentSha256 === sha256(existingText)
	? reverseNestedCheckedRecordDotnetPromotionUpdate(existingText, prior)
	: existingText;
assert.equal(restored, baselineText, "Never overwrite unrecorded inventory changes");

const promoted = await promoteNestedCheckedRecordDotnet(
	baseline, await nestedCheckedRecordDotnetReferences()
);
const preliminarySources = new Map();
for(const path of nestedCheckedRecordDotnetPromotionChangedPaths
	.filter(path => path !== inventoryPath)){
	const previous = git(["show"
		, `${nestedCheckedRecordDotnetPromotionPredecessor}:${path}`]);
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
		&& file.sha256 === update.previous){
		file.sha256 = update.current;
		refreshedPins.add(file);
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
for(const path of nestedCheckedRecordDotnetPromotionChangedPaths
	.filter(path => path !== inventoryPath)){
	const previous = git(["show"
		, `${nestedCheckedRecordDotnetPromotionPredecessor}:${path}`]);
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
		&& [update.previous, update.preliminary].includes(file.sha256)){
		file.sha256 = update.current;
		refreshedPins.add(file);
		}
}
const pins = refreshedPins.size;
const inventoryText = JSON.stringify(promoted, null, 2) + "\n";

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-nested-record-dotnet-promotion-history-draft-"
));
try
{
	const transition = async path => {
		const source = path === inventoryPath
			? inventoryText : await readFile(path, "utf8");
		const previous = git(["show"
			, `${nestedCheckedRecordDotnetPromotionPredecessor}:${path}`]);
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
		assert.equal(reverseNestedCheckedRecordDotnetPromotionUpdate(source, update)
			, previous);
		return update;
	};
	const updates = [];
	for(const path of nestedCheckedRecordDotnetPromotionChangedPaths)
		updates.push(await transition(path));
	await writeFile(inventoryPath, inventoryText);
	await writeFile(nestedCheckedRecordDotnetPromotionHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "nested-checked-record-dotnet-promotion-source-v1"
		, predecessorCommit: nestedCheckedRecordDotnetPromotionPredecessor
		, draftParentCommit: nestedCheckedRecordDotnetPromotionDraftParent
		, pinCount: pins
		, updates
	}, null, 2) + "\n");
	process.stdout.write(`Recorded ${updates.length} exact source transitions and refreshed ${pins} source pins; added four evidence entries and supplemented six C# cells.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

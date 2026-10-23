#!/usr/bin/env node
/**
 * Authenticate the final callback Subtype promotion and reconcile live pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackSubtypePromotionHistoryPath
	, callbackSubtypePromotionIntegrationPaths
	, callbackSubtypePromotionPredecessor
	, reverseCallbackSubtypePromotionUpdate
} from "../tests/helpers/callback-subtype-promotion-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypePromotionPredecessor
	, "Callback Subtype promotion history is draft-only at its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypePromotionHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype promotion history");

const inventoryPath = "docs/type-surface.v1.json";
const historyAdditions = Object.freeze([
	"scripts/update-callback-subtype-promotion-source-history.mjs"
	, "tests/helpers/callback-subtype-promotion-source-history.mjs"
	, "tests/helpers/callback-subtype-promotion-source-history-tests.mjs"
]);
const applicationAdditions = Object.freeze([
	"docs/evidence/callback-subtype-promotion-20261022.md"
]);
const draft = await readFile(callbackSubtypePromotionHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft) assert.equal(draft.predecessorCommit
	, callbackSubtypePromotionPredecessor);
const directory = await mkdtemp(join(tmpdir()
	, "lean-bridge-callback-subtype-promotion-history-"));

const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const value of currentLines)
		offsets.push(offsets.at(-1) + value.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.equal(reverseCallbackSubtypePromotionUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const modified = git(["diff", "--name-only", "--diff-filter=M"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...callbackSubtypePromotionIntegrationPaths].sort()
		, "Refuse unrelated or missing callback Subtype promotion changes");

	const previousHashes = new Map();
	for(const path of callbackSubtypePromotionIntegrationPaths)
	{
		if(path === inventoryPath) continue;
		const previous = git(["show"
			, `${callbackSubtypePromotionPredecessor}:${path}`]);
		const current = await readFile(path, "utf8");
		previousHashes.set(path, {
			previous: sha256(previous), current: sha256(current)
		});
	}
	const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
	let reconciledTypeSurfacePointers = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
	{
		const hashes = previousHashes.get(file.path);
		if(hashes === undefined || hashes.previous === hashes.current) continue;
		assert.ok(file.sha256 === hashes.previous
			|| file.sha256 === hashes.current
		, `${evidence.id}: unrecognized source pointer ${file.path}`);
		if(file.sha256 === hashes.previous)
		{
			file.sha256 = hashes.current;
		}
		reconciledTypeSurfacePointers++;
	}
	assert.ok(reconciledTypeSurfacePointers > 0
		, "Callback Subtype promotion must reconcile live source pointers");
	await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");

	const integrationUpdates = [];
	for(const path of callbackSubtypePromotionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${callbackSubtypePromotionPredecessor}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of [...applicationAdditions, ...historyAdditions])
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypePromotionPredecessor, "--", path]).trim(), ""
		, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-promotion-source-v1"
		, predecessorCommit: callbackSubtypePromotionPredecessor
		, reconciledTypeSurfacePointers
		, scope: "Eight immutable hosted archives promote exactly 64 synchronous callback Subtype cells across sixteen non-PHP-Wasm profiles and both author routes. Generated guides, the exact inventory transition and every live source-pointer advance remain independently reversible."
		, integrationUpdates, additions
	};
	await writeFile(callbackSubtypePromotionHistoryPath, canonicalJson(record));
	process.stdout.write(`Recorded ${integrationUpdates.length} transitions, `
		+ `${additions.length} additions and `
		+ `${reconciledTypeSurfacePointers} source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

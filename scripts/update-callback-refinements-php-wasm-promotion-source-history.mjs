#!/usr/bin/env node
/**
 * Record the exact PHP-Wasm callback-refinement promotion transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackRefinementsPhpWasmPromotionAddedPaths
	, callbackRefinementsPhpWasmPromotionCommit
	, callbackRefinementsPhpWasmPromotionHistoryAddedPaths
	, callbackRefinementsPhpWasmPromotionHistoryPath
	, callbackRefinementsPhpWasmPromotionIntegrationPaths
	, callbackRefinementsPhpWasmPromotionPredecessor
	, callbackRefinementsPhpWasmPromotionUpdatedPaths
	, reverseCallbackRefinementsPhpWasmPromotionIntegration
	, reverseCallbackRefinementsPhpWasmPromotionUpdate
} from "../tests/helpers/callback-refinements-php-wasm-promotion-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackRefinementsPhpWasmPromotionCommit
	, "PHP-Wasm callback promotion history requires its exact promotion commit");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"])
	, [...callbackRefinementsPhpWasmPromotionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackRefinementsPhpWasmPromotionHistoryAddedPaths])
, [...callbackRefinementsPhpWasmPromotionHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-refinement-promotion-history-"));
const transition = async (path, previous, current, reverse) => {
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
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverse(current, update), previous, path);
	return update;
};

try
{
	const promotionUpdates = [];
	for(const path of callbackRefinementsPhpWasmPromotionUpdatedPaths)
		promotionUpdates.push(await transition(path
			, git(["show", `${callbackRefinementsPhpWasmPromotionPredecessor}:${path}`])
			, git(["show", `${callbackRefinementsPhpWasmPromotionCommit}:${path}`])
			, reverseCallbackRefinementsPhpWasmPromotionUpdate));
	const promotionAdditions = callbackRefinementsPhpWasmPromotionAddedPaths.map(path => {
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${callbackRefinementsPhpWasmPromotionPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		return {
			path
			, currentSha256: sha256(git([
				"show"
				, `${callbackRefinementsPhpWasmPromotionCommit}:${path}`
			]))
		};
	});
	const integrationUpdates = [];
	for(const path of callbackRefinementsPhpWasmPromotionIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${callbackRefinementsPhpWasmPromotionCommit}:${path}`])
			, await readFile(path, "utf8")
			, reverseCallbackRefinementsPhpWasmPromotionIntegration));
	const historyAdditions = [];
	for(const path of callbackRefinementsPhpWasmPromotionHistoryAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${callbackRefinementsPhpWasmPromotionCommit}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		historyAdditions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackRefinementsPhpWasmPromotionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-refinements-php-wasm-promotion-v1"
		, predecessorCommit: callbackRefinementsPhpWasmPromotionPredecessor
		, promotionCommit: callbackRefinementsPhpWasmPromotionCommit
		, scope: "Promote the immutable hosted PHP-Wasm Fin and checked-record callback archive into eight exact inventory cells, split resource ownership from checked-record evidence, publish generated consumer guidance and authenticate this history integration."
		, promotionUpdates, promotionAdditions
		, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${promotionUpdates.length} promotion and ${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

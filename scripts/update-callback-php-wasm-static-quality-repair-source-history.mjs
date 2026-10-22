#!/usr/bin/env node
/**
 * Record the callback PHP-Wasm static-quality repair.
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
	callbackPhpWasmStaticQualityRepairAddedPaths
	, callbackPhpWasmStaticQualityRepairChangedPaths
	, callbackPhpWasmStaticQualityRepairHistoryPath
	, callbackPhpWasmStaticQualityRepairImplementation
	, callbackPhpWasmStaticQualityRepairIntegrationPaths
	, callbackPhpWasmStaticQualityRepairPredecessor
	, reverseCallbackPhpWasmStaticQualityRepairUpdate
} from "../tests/helpers/callback-php-wasm-static-quality-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackPhpWasmStaticQualityRepairImplementation
	, "Callback PHP-Wasm static-quality history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackPhpWasmStaticQualityRepairImplementation}^`]).trim()
, callbackPhpWasmStaticQualityRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, callbackPhpWasmStaticQualityRepairPredecessor
	, callbackPhpWasmStaticQualityRepairImplementation])
, [...callbackPhpWasmStaticQualityRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackPhpWasmStaticQualityRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-callback-php-wasm-static-quality-history-"));
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
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseCallbackPhpWasmStaticQualityRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackPhpWasmStaticQualityRepairChangedPaths)
		updates.push(await transition(path
			, git(["show", `${callbackPhpWasmStaticQualityRepairPredecessor}:${path}`])
			, git(["show", `${callbackPhpWasmStaticQualityRepairImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackPhpWasmStaticQualityRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${callbackPhpWasmStaticQualityRepairImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackPhpWasmStaticQualityRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackPhpWasmStaticQualityRepairPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackPhpWasmStaticQualityRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-php-wasm-static-quality-repair-source-v1"
			, predecessorCommit: callbackPhpWasmStaticQualityRepairPredecessor
			, implementationCommit: callbackPhpWasmStaticQualityRepairImplementation
			, scope: "Restore the repository-wide zero-warning static-quality contract for callback Subtype PHP-Wasm sources without changing runtime behavior."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

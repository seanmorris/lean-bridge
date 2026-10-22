#!/usr/bin/env node
/**
 * Record the PHP-Wasm refinement-entry generator-closure transition.
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
	phpWasmRefinementEntryGeneratorClosureAddedPaths
	, phpWasmRefinementEntryGeneratorClosureHistoryPath
	, phpWasmRefinementEntryGeneratorClosureImplementation
	, phpWasmRefinementEntryGeneratorClosureImplementationPaths
	, phpWasmRefinementEntryGeneratorClosureIntegrationPaths
	, phpWasmRefinementEntryGeneratorClosureModifiedPaths
	, phpWasmRefinementEntryGeneratorClosurePredecessor
	, reversePhpWasmRefinementEntryGeneratorClosureUpdate
} from "../tests/helpers/php-wasm-refinement-entry-generator-closure-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryGeneratorClosureImplementation
	, "PHP-Wasm refinement-entry generator history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementEntryGeneratorClosureImplementation}^`]).trim()
, phpWasmRefinementEntryGeneratorClosurePredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryGeneratorClosurePredecessor
	, phpWasmRefinementEntryGeneratorClosureImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryGeneratorClosureImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryGeneratorClosureHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-entry-generator-history-"));
const transitionSources = async (path, previous, current) => {
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
	assert.equal(reversePhpWasmRefinementEntryGeneratorClosureUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of phpWasmRefinementEntryGeneratorClosureModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${phpWasmRefinementEntryGeneratorClosurePredecessor}:${path}`])
			, git(["show", `${phpWasmRefinementEntryGeneratorClosureImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of phpWasmRefinementEntryGeneratorClosureIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${phpWasmRefinementEntryGeneratorClosureImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmRefinementEntryGeneratorClosureAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryGeneratorClosurePredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryGeneratorClosureHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-refinement-entry-generator-closure-v1"
			, predecessorCommit: phpWasmRefinementEntryGeneratorClosurePredecessor
			, implementationCommit: phpWasmRefinementEntryGeneratorClosureImplementation
			, scope: "Keep the documented 28-route, 26-artifact PHP-Wasm entry-measurement boundary inside the checked type-reference generator and preserve it across callback Subtype promotion."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

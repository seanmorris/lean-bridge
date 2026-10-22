#!/usr/bin/env node
/**
 * Record the PHP-Wasm refinement-entry documentation boundary milestone.
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
	phpWasmRefinementEntryDocumentationAddedPaths
	, phpWasmRefinementEntryDocumentationChangedPaths
	, phpWasmRefinementEntryDocumentationHistoryPath
	, phpWasmRefinementEntryDocumentationImplementation
	, phpWasmRefinementEntryDocumentationImplementationPaths
	, phpWasmRefinementEntryDocumentationPredecessor
	, reversePhpWasmRefinementEntryDocumentationUpdate
} from "../tests/helpers/php-wasm-refinement-entry-documentation-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementEntryDocumentationImplementation
	, "PHP-Wasm entry documentation history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementEntryDocumentationImplementation}^`]).trim()
, phpWasmRefinementEntryDocumentationPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementEntryDocumentationPredecessor
	, phpWasmRefinementEntryDocumentationImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementEntryDocumentationImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementEntryDocumentationHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-entry-documentation-history-"));
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
	assert.equal(reversePhpWasmRefinementEntryDocumentationUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementEntryDocumentationPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementEntryDocumentationChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryDocumentationPredecessor
			, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementEntryDocumentationChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementEntryDocumentationAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementEntryDocumentationPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementEntryDocumentationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "php-wasm-refinement-entry-documentation-v1"
		, predecessorCommit: phpWasmRefinementEntryDocumentationPredecessor
		, implementationCommit: phpWasmRefinementEntryDocumentationImplementation
		, scope: "PHP consumer, publisher, Lean-author and type-reference documentation now separate support proved by unmodified prepared packages from the 28-route, 26-artifact instrumented probe topology. The type inventory records the source-level probe contract without attaching it to any installed-support stage or claiming hosted counts before a verified promotion summary exists."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

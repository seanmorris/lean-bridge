#!/usr/bin/env node
/**
 * Record the PHP-Wasm refinement CI closure repair milestone.
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
	phpWasmRefinementCiClosureRepairAddedPaths
	, phpWasmRefinementCiClosureRepairChangedPaths
	, phpWasmRefinementCiClosureRepairHistoryPath
	, phpWasmRefinementCiClosureRepairImplementation
	, phpWasmRefinementCiClosureRepairImplementationPaths
	, phpWasmRefinementCiClosureRepairPredecessor
	, reversePhpWasmRefinementCiClosureRepairUpdate
} from "../tests/helpers/php-wasm-refinement-ci-closure-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementCiClosureRepairImplementation
	, "PHP-Wasm refinement CI closure history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementCiClosureRepairImplementation}^`]).trim()
, phpWasmRefinementCiClosureRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementCiClosureRepairPredecessor
	, phpWasmRefinementCiClosureRepairImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementCiClosureRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementCiClosureRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-ci-closure-history-"));
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
	assert.equal(reversePhpWasmRefinementCiClosureRepairUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementCiClosureRepairPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementCiClosureRepairChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementCiClosureRepairPredecessor
			, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementCiClosureRepairChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementCiClosureRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementCiClosureRepairPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementCiClosureRepairHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-refinement-ci-closure-repair-v1"
		, predecessorCommit: phpWasmRefinementCiClosureRepairPredecessor
		, implementationCommit: phpWasmRefinementCiClosureRepairImplementation
		, scope: "The dedicated PHP-Wasm refinement CI audit now derives every measurement cell from the exact YAML matrix axes and rejects include or exclude suppression, extra triggers, job-level conditions, any continue-on-error policy, altered acceptance bodies, artifact-name drift and truncated upload inventories. The entry topology is tied to those workflow matrices and artifact templates and to the exact record/check layouts in all three producer scripts. The aggregate topology remains a consistency gate; the separate hosted verifier authenticates retained artifact bytes."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

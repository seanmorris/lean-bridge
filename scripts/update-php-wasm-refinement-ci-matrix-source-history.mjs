#!/usr/bin/env node
/**
 * Record the complete PHP-Wasm refinement CI matrix audit.
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
	phpWasmRefinementCiMatrixAddedPaths
	, phpWasmRefinementCiMatrixChangedPaths
	, phpWasmRefinementCiMatrixHistoryPath
	, phpWasmRefinementCiMatrixImplementation
	, phpWasmRefinementCiMatrixImplementationPaths
	, phpWasmRefinementCiMatrixPredecessor
	, reversePhpWasmRefinementCiMatrixUpdate
} from "../tests/helpers/php-wasm-refinement-ci-matrix-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmRefinementCiMatrixImplementation
	, "PHP-Wasm refinement CI matrix history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmRefinementCiMatrixImplementation}^`]).trim()
, phpWasmRefinementCiMatrixPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmRefinementCiMatrixPredecessor
	, phpWasmRefinementCiMatrixImplementation]).trim().split("\n").sort()
, [...phpWasmRefinementCiMatrixImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmRefinementCiMatrixHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-refinement-ci-history-"));
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
	assert.equal(reversePhpWasmRefinementCiMatrixUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmRefinementCiMatrixPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmRefinementCiMatrixChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmRefinementCiMatrixPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmRefinementCiMatrixChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmRefinementCiMatrixAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmRefinementCiMatrixPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmRefinementCiMatrixHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-refinement-ci-matrix-v1"
		, predecessorCommit: phpWasmRefinementCiMatrixPredecessor
		, implementationCommit: phpWasmRefinementCiMatrixImplementation
		, scope: "The dedicated PHP-Wasm refinement CI surface is a closed eighteen-workflow inventory tied to its owning #1220 requirement nodes. Fourteen serial acceptance workflows and four bounded measurement matrices retain exact triggers, immutable history checkout, pinned toolchain setup, partial/original artifact uploads and terminal failure enforcement. Twenty-six instrumented cells run with at most two cells per measurement workflow and remain explicitly separate from unmodified-package acceptance. The existing consumer-matrix corpus remains governed by its independent partition contract."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

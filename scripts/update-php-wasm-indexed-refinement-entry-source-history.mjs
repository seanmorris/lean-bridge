#!/usr/bin/env node
/**
 * Record the dependent/indexed PHP-Wasm entry-measurement implementation.
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
	phpWasmIndexedRefinementEntryAddedPaths
	, phpWasmIndexedRefinementEntryChangedPaths
	, phpWasmIndexedRefinementEntryHistoryPath
	, phpWasmIndexedRefinementEntryImplementation
	, phpWasmIndexedRefinementEntryImplementationPaths
	, phpWasmIndexedRefinementEntryPredecessor
	, reversePhpWasmIndexedRefinementEntryUpdate
} from "../tests/helpers/php-wasm-indexed-refinement-entry-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmIndexedRefinementEntryImplementation
	, "indexed PHP-Wasm entry history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${phpWasmIndexedRefinementEntryImplementation}^`]).trim()
, phpWasmIndexedRefinementEntryPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, phpWasmIndexedRefinementEntryPredecessor
	, phpWasmIndexedRefinementEntryImplementation]).trim().split("\n").sort()
, [...phpWasmIndexedRefinementEntryImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmIndexedRefinementEntryHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-indexed-php-wasm-entry-history-"));
const transitionSources = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
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
	assert.equal(reversePhpWasmIndexedRefinementEntryUpdate(current, update)
		, previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show", `${phpWasmIndexedRefinementEntryPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of phpWasmIndexedRefinementEntryChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, phpWasmIndexedRefinementEntryPredecessor, "--", path]).trim(), "", path);
	const updates = [];
	for(const path of phpWasmIndexedRefinementEntryChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of phpWasmIndexedRefinementEntryAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmIndexedRefinementEntryPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmIndexedRefinementEntryHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "php-wasm-indexed-refinement-entry-v1"
		, predecessorCommit: phpWasmIndexedRefinementEntryPredecessor
		, implementationCommit: phpWasmIndexedRefinementEntryImplementation
		, scope: "Dependent, closed Bool/String/Nat-indexed and zero-payload checked records run through six compact PHP-Wasm probes, with input-checking and result-only proof-erasure packages kept distinct. Compiler-generated flat copied adapters supply public, validator and adapter identities; authored wrappers supply constructor and source identities. Independent plans cover valid calls, first refusal, recovery, wide indices, repeated results and active versus inactive variant branches. A dedicated twelve-cell hosted matrix reproduces ordinary and reviewed packages twice, installs them offline in embedded and Composer layouts, executes weak and strict callers eagerly and lazily in Node and Chromium, and retains closed adversarially rechecked records. The probe is a separate instrumented build and makes no unmodified-package dispatch-count claim."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

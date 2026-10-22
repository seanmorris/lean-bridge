#!/usr/bin/env node
/**
 * Record the omitted owned-Subtype PHP-Wasm package source transition.
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
	ownedSubtypePhpWasmPackageGapAddedPaths
	, ownedSubtypePhpWasmPackageGapHistoricalAdditions
	, ownedSubtypePhpWasmPackageGapHistoricalPaths
	, ownedSubtypePhpWasmPackageGapHistoryPath
	, ownedSubtypePhpWasmPackageGapImplementation
	, ownedSubtypePhpWasmPackageGapIntegrationPaths
	, ownedSubtypePhpWasmPackageGapIntegrationPredecessor
	, ownedSubtypePhpWasmPackageGapPredecessor
	, reverseOwnedSubtypePhpWasmPackageGapHistorical
	, reverseOwnedSubtypePhpWasmPackageGapIntegration
} from "../tests/helpers/owned-subtype-php-wasm-package-gap-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypePhpWasmPackageGapIntegrationPredecessor
	, "owned-Subtype PHP-Wasm package-gap history requires its exact integration predecessor");
assert.equal(git(["rev-parse", `${ownedSubtypePhpWasmPackageGapImplementation}^`]).trim()
	, ownedSubtypePhpWasmPackageGapPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypePhpWasmPackageGapPredecessor
	, ownedSubtypePhpWasmPackageGapImplementation]).trim().split("\n").sort()
, [...ownedSubtypePhpWasmPackageGapHistoricalPaths
	, ...ownedSubtypePhpWasmPackageGapHistoricalAdditions].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedSubtypePhpWasmPackageGapHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-subtype-php-wasm-package-gap-"));
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
	return { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
};

try
{
	const historicalUpdates = [];
	for(const path of ownedSubtypePhpWasmPackageGapHistoricalPaths)
	{
		const previous = git(["show"
			, `${ownedSubtypePhpWasmPackageGapPredecessor}:${path}`]);
		const current = git(["show"
			, `${ownedSubtypePhpWasmPackageGapImplementation}:${path}`]);
		const update = await transition(path, previous, current);
		assert.equal(reverseOwnedSubtypePhpWasmPackageGapHistorical(
			current, update), previous, path);
		historicalUpdates.push(update);
	}
	const historicalAdditions = [];
	for(const path of ownedSubtypePhpWasmPackageGapHistoricalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypePhpWasmPackageGapPredecessor, "--", path]).trim(), "", path);
		const current = git(["show"
			, `${ownedSubtypePhpWasmPackageGapImplementation}:${path}`]);
		historicalAdditions.push({ path, currentSha256: sha256(current) });
	}
	const integrationUpdates = [];
	for(const path of ownedSubtypePhpWasmPackageGapIntegrationPaths)
	{
		const previous = git(["show"
			, `${ownedSubtypePhpWasmPackageGapIntegrationPredecessor}:${path}`]);
		const current = await readFile(path, "utf8");
		const update = await transition(path, previous, current);
		assert.equal(reverseOwnedSubtypePhpWasmPackageGapIntegration(
			current, update), previous, path);
		integrationUpdates.push(update);
	}
	assert.deepEqual(git(["diff", "--name-only"]).trim().split("\n")
		.filter(Boolean).sort(), [...ownedSubtypePhpWasmPackageGapIntegrationPaths].sort());
	const additions = [];
	for(const path of ownedSubtypePhpWasmPackageGapAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypePhpWasmPackageGapIntegrationPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedSubtypePhpWasmPackageGapHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-subtype-php-wasm-package-gap-v1"
		, predecessorCommit: ownedSubtypePhpWasmPackageGapPredecessor
		, implementationCommit: ownedSubtypePhpWasmPackageGapImplementation
		, integrationPredecessorCommit:
			ownedSubtypePhpWasmPackageGapIntegrationPredecessor
		, scope: "Restore the exact owned-Subtype PHP-Wasm package implementation transition omitted before its later qualification history. This changes no runtime or support claim."
		, historicalUpdates, historicalAdditions, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${historicalUpdates.length} historical updates, `
		+ `${historicalAdditions.length} historical additions, `
		+ `${integrationUpdates.length} integrations and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

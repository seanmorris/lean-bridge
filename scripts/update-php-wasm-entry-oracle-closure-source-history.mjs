#!/usr/bin/env node
/**
 * Record the exact PHP-Wasm entry-oracle closure.
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
	reversePhpWasmEntryOracleClosureUpdate
	, phpWasmEntryOracleClosureAddedPaths
	, phpWasmEntryOracleClosureHistoryPath
	, phpWasmEntryOracleClosureImplementation
	, phpWasmEntryOracleClosureImplementationPaths
	, phpWasmEntryOracleClosureIntegrationPaths
	, phpWasmEntryOracleClosureModifiedPaths
	, phpWasmEntryOracleClosurePredecessor
} from "../tests/helpers/php-wasm-entry-oracle-closure-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = phpWasmEntryOracleClosureImplementation;
const predecessor = phpWasmEntryOracleClosurePredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "PHP-Wasm entry-oracle closure requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...phpWasmEntryOracleClosureImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryOracleClosureHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-oracle-closure-"
));
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
	const currentOffsets = [0];
	for(const line of currentLines)
		currentOffsets.push(currentOffsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
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
	assert.equal(reversePhpWasmEntryOracleClosureUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of phpWasmEntryOracleClosureModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of phpWasmEntryOracleClosureIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of phpWasmEntryOracleClosureAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmEntryOracleClosureHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-oracle-closure-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "PHP-Wasm refinement entry plans derive graph order, module-initialized entries, reduced-arity call targets, owned transfer completion, and bounded failure diagnostics from authenticated compiler and deployment inputs."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

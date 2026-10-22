#!/usr/bin/env node
/**
 * Record the PHP-Wasm nominal callback-refusal repair.
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
	callbackFinPhpWasmNominalRefusalRepairChangedPaths
	, callbackFinPhpWasmNominalRefusalRepairHistoryPath
	, callbackFinPhpWasmNominalRefusalRepairImplementation
	, callbackFinPhpWasmNominalRefusalRepairIntegrationBase
	, callbackFinPhpWasmNominalRefusalRepairIntegrationPaths
	, callbackFinPhpWasmNominalRefusalRepairPredecessor
	, reverseCallbackFinPhpWasmNominalRefusalRepairUpdate
} from "../tests/helpers/callback-fin-php-wasm-nominal-refusal-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const integrationBase = callbackFinPhpWasmNominalRefusalRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "PHP-Wasm nominal callback-refusal repair history is draft-only at its integration base commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinPhpWasmNominalRefusalRepairHistoryPath]).trim(), "");

const additions = Object.freeze([
	"scripts/update-callback-fin-php-wasm-nominal-refusal-repair-source-history.mjs"
	, "tests/helpers/callback-fin-php-wasm-nominal-refusal-repair-source-history.mjs"
	, "tests/helpers/callback-fin-php-wasm-nominal-refusal-repair-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "callback-fin-php-wasm-nominal-refusal-repair-history-"));
const transition = async (path, revision) => {
	const previous = git(["show", `${revision}:${path}`]);
	const current = await readFile(path, "utf8");
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
				previousStart, previousStart + previousCount
			).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount
			).join("")
		};
	});
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseCallbackFinPhpWasmNominalRefusalRepairUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackFinPhpWasmNominalRefusalRepairChangedPaths)
	{
		const current = await readFile(path, "utf8");
		assert.equal(current, git(["show"
			, `${callbackFinPhpWasmNominalRefusalRepairImplementation}:${path}`])
		, `Later work changed ${path}; record a composed transition instead`);
		updates.push(await transition(
			path, callbackFinPhpWasmNominalRefusalRepairPredecessor));
	}
	const integrationUpdates = [];
	for(const path of callbackFinPhpWasmNominalRefusalRepairIntegrationPaths)
		integrationUpdates.push(await transition(path, integrationBase));
	const added = [];
	for(const path of additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, integrationBase, "--", path]).trim(), "", path);
		added.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, integrationBase, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...callbackFinPhpWasmNominalRefusalRepairIntegrationPaths].sort());
	await writeFile(callbackFinPhpWasmNominalRefusalRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-fin-php-wasm-nominal-refusal-repair-source-v1"
		, predecessorCommit: callbackFinPhpWasmNominalRefusalRepairPredecessor
		, implementationCommit: callbackFinPhpWasmNominalRefusalRepairImplementation
		, integrationBaseCommit: integrationBase
		, scope: "PHP-Wasm returned closures locate shared nominal Fin-field refusals without changing reusable callback direction, report them as invalid arguments instead of runtime corruption, recover for later calls, and exercise Unit arguments and exact callback accounting."
		, updates, integrationUpdates, additions: added
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, `
		+ `${integrationUpdates.length} integrations and `
		+ `${added.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

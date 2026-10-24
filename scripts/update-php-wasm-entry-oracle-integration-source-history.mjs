#!/usr/bin/env node
/**
 * Record the two-parent integration of the compiler-derived PHP-Wasm entry
 * oracle with the ordered repair lineage.
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
	phpWasmEntryOracleIntegrationAddedPaths
	, phpWasmEntryOracleIntegrationChangedPaths
	, phpWasmEntryOracleIntegrationCommit
	, phpWasmEntryOracleIntegrationHistoryPath
	, phpWasmEntryOracleIntegrationLeftParent
	, phpWasmEntryOracleIntegrationRightParent
	, reversePhpWasmEntryOracleIntegrationUpdate
} from "../tests/helpers/php-wasm-entry-oracle-integration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmEntryOracleIntegrationCommit
	, "PHP-Wasm entry-oracle history requires its exact integration commit");
assert.deepEqual(git(["show", "-s", "--format=%P", "HEAD"])
	.trim().split(" "), [
	phpWasmEntryOracleIntegrationLeftParent
	, phpWasmEntryOracleIntegrationRightParent
	]
);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, phpWasmEntryOracleIntegrationHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", "HEAD", "--"])
	, [
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmEntryOracleIntegrationAddedPaths])
, [...phpWasmEntryOracleIntegrationAddedPaths].sort());

const fork = git(["merge-base"
	, phpWasmEntryOracleIntegrationLeftParent
	, phpWasmEntryOracleIntegrationRightParent]).trim();
const rightHistoryRecords = names(["diff", "--name-only", "--diff-filter=A"
	, fork, phpWasmEntryOracleIntegrationRightParent, "--", "docs/evidence"])
	.filter(path => /^docs\/evidence\/[^/]*history[^/]*\.json$/u.test(path));
assert.ok(rightHistoryRecords.length > 0);

const rightExpected = path => {
	const result = new Set([sha256(git(["show"
		, `${phpWasmEntryOracleIntegrationRightParent}:${path}`]))]);
	const collect = value => {
		if(!value || typeof value !== "object") return;
		if(value.path === path)
			for(const key of ["currentSha256", "previousSha256"])
				if(typeof value[key] === "string"
					&& /^[a-f0-9]{64}$/u.test(value[key])) result.add(value[key]);
		for(const child of Object.values(value)) collect(child);
	};
	for(const historyPath of rightHistoryRecords)
	{
		let value;
		try
		{
			value = JSON.parse(git(["show"
				, `${phpWasmEntryOracleIntegrationRightParent}:${historyPath}`]));
		}
		catch(error)
		{
			if(error instanceof SyntaxError) continue;
			throw error;
		}
		collect(value);
	}
	return [...result].sort();
};

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-entry-oracle-integration-"
));
const edits = async (previous, current) => {
	if(previous === current) return [];
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
	const result = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(result.length > 0);
	return result;
};

try
{
	const updates = [];
	for(const path of phpWasmEntryOracleIntegrationChangedPaths)
	{
		const current = await readFile(path, "utf8");
		const left = git(["show"
			, `${phpWasmEntryOracleIntegrationLeftParent}:${path}`]);
		const right = git(["show"
			, `${phpWasmEntryOracleIntegrationRightParent}:${path}`]);
		const update = {
			path, currentSha256: sha256(current)
			, left: {
				previousSha256: sha256(left), edits: await edits(left, current)
			}
			, right: {
				previousSha256: sha256(right), edits: await edits(right, current)
			}
			, rightExpectedSha256: rightExpected(path)
		};
		assert.equal(reversePhpWasmEntryOracleIntegrationUpdate(
			current, update, "left"), left, path);
		assert.equal(reversePhpWasmEntryOracleIntegrationUpdate(
			current, update, "right"), right, path);
		assert.ok(update.rightExpectedSha256.includes(sha256(right)));
		updates.push(update);
	}
	const additions = [];
	for(const path of phpWasmEntryOracleIntegrationAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${phpWasmEntryOracleIntegrationCommit}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(phpWasmEntryOracleIntegrationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-entry-oracle-integration-source-v1"
			, integrationCommit: phpWasmEntryOracleIntegrationCommit
			, parents: [
				phpWasmEntryOracleIntegrationLeftParent
				, phpWasmEntryOracleIntegrationRightParent
			]
			, forkCommit: fork, rightHistoryRecords
			, scope: "The ordered PHP-Wasm copied-entry repairs and the compiler-derived call-path, unreached-source and flat-position oracles retain both exact parent histories. Right-parent-only milestone digests select that parent; shared ancestry follows the ordered first parent."
			, additions, updates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} two-parent transitions, `
		+ `${additions.length} additions and ${rightHistoryRecords.length} right-parent histories.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

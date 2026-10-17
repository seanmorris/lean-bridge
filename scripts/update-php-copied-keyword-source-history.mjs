#!/usr/bin/env node
/**
 * Record PHP copied-function keyword escaping without changing an earlier
 * source-history ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	phpCopiedKeywordAddedPaths
	, phpCopiedKeywordChangedPaths
	, phpCopiedKeywordDraftParent
	, phpCopiedKeywordHistoryPath
	, phpCopiedKeywordPredecessor
	, reversePhpCopiedKeywordUpdate
} from "../tests/helpers/php-copied-keyword-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpCopiedKeywordDraftParent
	, "PHP copied keyword history must stay on its exact draft parent");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, phpCopiedKeywordPredecessor
	, phpCopiedKeywordDraftParent]).status, 0
, "PHP copied keyword predecessor must remain an ancestor");
assert.equal(git(["ls-tree", "--name-only"
	, phpCopiedKeywordDraftParent, "--"
	, phpCopiedKeywordHistoryPath]).trim(), ""
, "Never rewrite a committed PHP copied keyword ledger");
const draft = await readFile(
	phpCopiedKeywordHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "php-copied-keyword-source-v1");
	assert.equal(draft.predecessorCommit, phpCopiedKeywordPredecessor);
	assert.equal(draft.draftParentCommit, phpCopiedKeywordDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, phpCopiedKeywordPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...phpCopiedKeywordChangedPaths].sort());

const sources = new Map();
for(const path of phpCopiedKeywordChangedPaths)
{
	const previous = git(["show"
		, `${phpCopiedKeywordPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of phpCopiedKeywordAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${phpCopiedKeywordPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-copied-keyword-history-"
));
try
{
	const transition = async path => {
		const { previous, current } = sources.get(path);
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
		const update = {
			path, previousSha256: sha256(previous)
			, currentSha256: sha256(current), edits
		};
		assert.equal(reversePhpCopiedKeywordUpdate(
			current, update), previous);
		return update;
	};
	const updates = [];
	for(const path of phpCopiedKeywordChangedPaths)
		updates.push(await transition(path));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "php-copied-keyword-source-v1"
		, predecessorCommit: phpCopiedKeywordPredecessor
		, draftParentCommit: phpCopiedKeywordDraftParent
		, pathsSha256: sha256(JSON.stringify(
			phpCopiedKeywordChangedPaths))
		, additions, updates
	}, null, 2) + "\n";
	await writeFile(phpCopiedKeywordHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} transitions and ${additions.length} additions.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

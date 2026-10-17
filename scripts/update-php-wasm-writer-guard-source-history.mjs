#!/usr/bin/env node
/**
 * Record PHP-Wasm history-writer guard repair without changing an earlier
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
	phpWasmWriterGuardAddedPaths
	, phpWasmWriterGuardChangedPaths
	, phpWasmWriterGuardDraftParent
	, phpWasmWriterGuardHistoryPath
	, phpWasmWriterGuardPredecessor
	, reversePhpWasmWriterGuardUpdate
} from "../tests/helpers/php-wasm-writer-guard-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmWriterGuardDraftParent
	, "PHP-Wasm writer guard history must stay on its exact draft parent");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, phpWasmWriterGuardPredecessor
	, phpWasmWriterGuardDraftParent]).status, 0
, "PHP-Wasm writer guard predecessor must remain an ancestor");
assert.equal(git(["ls-tree", "--name-only"
	, phpWasmWriterGuardDraftParent, "--"
	, phpWasmWriterGuardHistoryPath]).trim(), ""
, "Never rewrite a committed PHP-Wasm writer guard ledger");
const draft = await readFile(
	phpWasmWriterGuardHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "php-wasm-writer-guard-source-v1");
	assert.equal(draft.predecessorCommit, phpWasmWriterGuardPredecessor);
	assert.equal(draft.draftParentCommit, phpWasmWriterGuardDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, phpWasmWriterGuardPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...phpWasmWriterGuardChangedPaths].sort());

const sources = new Map();
for(const path of phpWasmWriterGuardChangedPaths)
{
	const previous = git(["show"
		, `${phpWasmWriterGuardPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of phpWasmWriterGuardAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${phpWasmWriterGuardPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-php-wasm-writer-guard-history-"
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
		assert.equal(reversePhpWasmWriterGuardUpdate(
			current, update), previous);
		return update;
	};
	const updates = [];
	for(const path of phpWasmWriterGuardChangedPaths)
		updates.push(await transition(path));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "php-wasm-writer-guard-source-v1"
		, predecessorCommit: phpWasmWriterGuardPredecessor
		, draftParentCommit: phpWasmWriterGuardDraftParent
		, pathsSha256: sha256(JSON.stringify(
			phpWasmWriterGuardChangedPaths))
		, additions, updates
	}, null, 2) + "\n";
	await writeFile(phpWasmWriterGuardHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(
		`Recorded ${updates.length} transitions and ${additions.length} additions.\n`
	);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

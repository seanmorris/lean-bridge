#!/usr/bin/env node
/**
 * Record the delayed PHP-Wasm value-index lineage from exact Git blobs.
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
	checkedRecordValueIndexPhpWasmChangedPaths
	, checkedRecordValueIndexPhpWasmHistoryAddedPaths
	, checkedRecordValueIndexPhpWasmHistoryPath
	, checkedRecordValueIndexPhpWasmRegistrationParent
	, checkedRecordValueIndexPhpWasmRegistrationPaths
	, checkedRecordValueIndexPhpWasmTransitions
	, reverseCheckedRecordValueIndexPhpWasmUpdate
} from "../tests/helpers/checked-record-value-index-php-wasm-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexPhpWasmRegistrationParent
	, "PHP-Wasm value-index history must stay on its exact registration parent");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexPhpWasmRegistrationParent}:${checkedRecordValueIndexPhpWasmHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed PHP-Wasm history");
for(const transition of checkedRecordValueIndexPhpWasmTransitions)
{
	assert.equal(git(["rev-parse", `${transition.currentCommit}^`]).trim()
		, transition.previousCommit, transition.name);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, transition.currentCommit, checkedRecordValueIndexPhpWasmRegistrationParent]
	, { stdio: "ignore" }).status, 0, transition.name);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, transition.previousCommit, transition.currentCommit])
	, [...transition.modifiedPaths].sort(), transition.name);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
		, transition.previousCommit, transition.currentCommit])
	, [...transition.addedPaths].sort(), transition.name);
}
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"])
	, [...checkedRecordValueIndexPhpWasmRegistrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexPhpWasmHistoryAddedPaths])
, [...checkedRecordValueIndexPhpWasmHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-history-"));
try
{
	const edits = async (previous, current) => {
		const before = join(directory, "before"), after = join(directory, "after");
		await writeFile(before, previous); await writeFile(after, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, before, after], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const beforeLines = previous.split(/(?<=\n)/u);
		const afterLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
			const beforeCount = Number(match[2] ?? 1);
			const afterCount = Number(match[4] ?? 1);
			const beforeStart = Number(match[1]) - (beforeCount ? 1 : 0);
			const afterStart = Number(match[3]) - (afterCount ? 1 : 0);
			return {
				start: afterLines.slice(0, afterStart).join("").length
				, previous: beforeLines.slice(beforeStart
					, beforeStart + beforeCount).join("")
				, current: afterLines.slice(afterStart
					, afterStart + afterCount).join("")
			};
		});
		assert.ok(result.length > 0); return result;
	};
	const updates = [];
	for(const transition of checkedRecordValueIndexPhpWasmTransitions)
	{
		for(const path of transition.modifiedPaths)
		{
			const previous = git(["show", `${transition.previousCommit}:${path}`]);
			const current = git(["show", `${transition.currentCommit}:${path}`]);
			const update = {
				transition: transition.name, path
				, previousCommit: transition.previousCommit
				, currentCommit: transition.currentCommit
				, previousSha256: sha256(previous), currentSha256: sha256(current)
				, edits: await edits(previous, current)
			};
			assert.equal(reverseCheckedRecordValueIndexPhpWasmUpdate(current, update)
				, previous, path);
			updates.push(update);
		}
	}
	for(const path of checkedRecordValueIndexPhpWasmRegistrationPaths)
	{
		const previous = git(["show"
			, `${checkedRecordValueIndexPhpWasmRegistrationParent}:${path}`]);
		const current = await readFile(path, "utf8");
		const update = {
			transition: "history-registration", path
			, previousCommit: checkedRecordValueIndexPhpWasmRegistrationParent
			, currentCommit: null
			, previousSha256: sha256(previous), currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseCheckedRecordValueIndexPhpWasmUpdate(current, update)
			, previous, path);
		updates.unshift(update);
	}
	const historicalAdditions = checkedRecordValueIndexPhpWasmTransitions
		.flatMap(transition => transition.addedPaths.map(path => ({
			transition: transition.name, path
			, currentSha256: sha256(git(["show"
				, `${transition.currentCommit}:${path}`]))
		})));
	const additions = [];
	for(const path of checkedRecordValueIndexPhpWasmHistoryAddedPaths)
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	await writeFile(checkedRecordValueIndexPhpWasmHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-php-wasm-source-v1"
		, registrationParent: checkedRecordValueIndexPhpWasmRegistrationParent
		, registrationPaths: checkedRecordValueIndexPhpWasmRegistrationPaths
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexPhpWasmChangedPaths))
		, transitions: checkedRecordValueIndexPhpWasmTransitions.map(({
			name, previousCommit, currentCommit, modifiedPaths, addedPaths
		}) => ({ name, previousCommit, currentCommit, modifiedPaths, addedPaths }))
		, historicalAdditions, additions, updates
	}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP-Wasm value-index transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

#!/usr/bin/env node
/**
 * Record the native TAP contract repair before its first commit.
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
	valueIndexNativeTapContractAddedPaths
	, valueIndexNativeTapContractChangedPaths
	, valueIndexNativeTapContractHistoryPath
	, valueIndexNativeTapContractPredecessor
	, reverseValueIndexNativeTapContractUpdate
} from "../tests/helpers/value-index-native-tap-contract-source-history.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, valueIndexNativeTapContractPredecessor
	, "native TAP contract repair history must stay on its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${valueIndexNativeTapContractPredecessor}:${valueIndexNativeTapContractHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed native TAP contract repair history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"])
	, [...valueIndexNativeTapContractChangedPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...valueIndexNativeTapContractAddedPaths])
, [...valueIndexNativeTapContractAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-native-tap-history-"));
try
{
	const edits = async (previous, current) => {
		const before = join(directory, "before"), after = join(directory, "after");
		await writeFile(before, previous); await writeFile(after, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0", before, after]
				, { encoding: "utf8" });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u), currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)]
			.map(match => {
				const beforeCount = Number(match[2] ?? 1), afterCount = Number(match[4] ?? 1);
				const beforeStart = Number(match[1]) - (beforeCount ? 1 : 0);
				const afterStart = Number(match[3]) - (afterCount ? 1 : 0);
				return { start: currentLines.slice(0, afterStart).join("").length
					, previous: previousLines.slice(beforeStart, beforeStart + beforeCount).join("")
					, current: currentLines.slice(afterStart, afterStart + afterCount).join("") };
			});
		assert.ok(result.length); return result;
	};
	const updates = [];
	for(const path of valueIndexNativeTapContractChangedPaths)
	{
		const previous = git(["show", `${valueIndexNativeTapContractPredecessor}:${path}`]);
		const current = await readFile(path, "utf8");
		const update = { path
			, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, edits: await edits(previous, current) };
		assert.equal(reverseValueIndexNativeTapContractUpdate(current, update), previous, path);
		updates.push(update);
	}
	const additions = [];
	for(const path of valueIndexNativeTapContractAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${valueIndexNativeTapContractPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(valueIndexNativeTapContractHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "value-index-native-tap-contract-source-v1"
		, predecessorCommit: valueIndexNativeTapContractPredecessor
		, pathsSha256: sha256(JSON.stringify(valueIndexNativeTapContractChangedPaths))
		, additions
		, updates
	}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} native TAP contract repair transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

#!/usr/bin/env node
/** Record the exact contract-profile registration for matrix tests. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexMatrixRegistrationChangedPaths
	, checkedRecordValueIndexMatrixRegistrationDraftParent
	, checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths
	, checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths
	, checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths
	, checkedRecordValueIndexMatrixRegistrationHistoryPath
	, checkedRecordValueIndexMatrixRegistrationPredecessor
	, reverseCheckedRecordValueIndexMatrixRegistrationUpdate
} from "../tests/helpers/checked-record-value-index-matrix-registration-source-history.mjs";

const addedTests = [
	"checked-record-value-index-matrix"
	, "checked-record-value-index-matrix-inventory"
];
const profilePath = "src/adoption/test-profiles.mjs";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexMatrixRegistrationDraftParent
	, "Value-index matrix registration history must stay on its exact registration commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexMatrixRegistrationPredecessor
	, "Value-index matrix registration must have its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexMatrixRegistrationDraftParent}:${checkedRecordValueIndexMatrixRegistrationHistoryPath}`]
, { stdio: "ignore" }).status, 0
, "Never rewrite committed value-index matrix registration history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexMatrixRegistrationPredecessor
	, checkedRecordValueIndexMatrixRegistrationDraftParent])
, [...checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexMatrixRegistrationPredecessor
	, checkedRecordValueIndexMatrixRegistrationDraftParent])
, [...checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths].sort());
assert.deepEqual([...new Set([
	...names(["ls-files", "--others", "--exclude-standard", "--"
		, ...checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths])
	, ...names(["diff", "--cached", "--name-only", "--diff-filter=A", "--"
		, ...checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths])
])].sort(), [...checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"
	, "tests/checked-record-value-index-matrix.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"]), [
	"tests/checked-record-value-index-matrix.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

const sources = new Map();
for(const path of checkedRecordValueIndexMatrixRegistrationChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexMatrixRegistrationPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
for(const name of addedTests) assert.equal(
	sources.get(profilePath).current.split(`\t\t, "${name}"\n`).length, 2, name
);
const additions = [];
for(const path of checkedRecordValueIndexMatrixRegistrationHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexMatrixRegistrationPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-matrix-registration-history-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
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
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of checkedRecordValueIndexMatrixRegistrationChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		if(path === profilePath) update.addedTests = addedTests;
		assert.equal(reverseCheckedRecordValueIndexMatrixRegistrationUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexMatrixRegistrationHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-matrix-registration-source-v1"
			, predecessorCommit: checkedRecordValueIndexMatrixRegistrationPredecessor
			, draftParentCommit: checkedRecordValueIndexMatrixRegistrationDraftParent
			, foundation: {
				modifiedPaths: checkedRecordValueIndexMatrixRegistrationFoundationModifiedPaths
				, addedPaths: checkedRecordValueIndexMatrixRegistrationFoundationAddedPaths
			}
			, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index matrix registration transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

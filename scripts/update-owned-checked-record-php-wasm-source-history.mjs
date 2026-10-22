#!/usr/bin/env node
/**
 * Record the missing PHP-Wasm owned refinement qualification histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	ownedCheckedRecordPhpWasmAddedPaths
	, ownedCheckedRecordPhpWasmChangedPaths
	, ownedCheckedRecordPhpWasmEvidencePath
	, ownedCheckedRecordPhpWasmHistoryPath
	, ownedCheckedRecordPhpWasmImplementation
	, ownedCheckedRecordPhpWasmImplementationPaths
	, ownedCheckedRecordPhpWasmPredecessor
	, reverseOwnedCheckedRecordPhpWasmUpdate
} from "../tests/helpers/owned-checked-record-php-wasm-source-history.mjs";
import {
	ownedSubtypePhpWasmQualificationAddedPaths
	, ownedSubtypePhpWasmQualificationChangedPaths
	, ownedSubtypePhpWasmQualificationEvidencePath
	, ownedSubtypePhpWasmQualificationHistoryPath
	, ownedSubtypePhpWasmQualificationImplementation
	, ownedSubtypePhpWasmQualificationPredecessor
	, reverseOwnedSubtypePhpWasmQualificationUpdate
} from "../tests/helpers/owned-subtype-php-wasm-qualification-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordPhpWasmImplementation
	, "PHP-Wasm owned checked-record history is draft-only at its implementation commit");
assert.equal(git(["merge-base", ownedSubtypePhpWasmQualificationPredecessor
	, ownedSubtypePhpWasmQualificationImplementation]).trim()
, ownedSubtypePhpWasmQualificationPredecessor);
assert.equal(git(["merge-base", ownedCheckedRecordPhpWasmPredecessor
	, ownedCheckedRecordPhpWasmImplementation]).trim()
, ownedCheckedRecordPhpWasmPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedSubtypePhpWasmQualificationPredecessor
	, ownedSubtypePhpWasmQualificationImplementation]).trim().split("\n").sort()
, [...ownedSubtypePhpWasmQualificationChangedPaths
	, ...ownedSubtypePhpWasmQualificationAddedPaths].sort());
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordPhpWasmPredecessor
	, ownedCheckedRecordPhpWasmImplementation]).trim().split("\n").sort()
, [...ownedCheckedRecordPhpWasmImplementationPaths].sort());
for(const path of [ownedSubtypePhpWasmQualificationHistoryPath
	, ownedCheckedRecordPhpWasmHistoryPath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim(), ""
		, `Never rewrite committed history: ${path}`);

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-php-wasm-history-"
));
const transition = async ({ path, previous, current, reverse }) => {
	assert.notEqual(current, previous, path);
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
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverse(current, update), previous, path);
	return update;
};

try
{
	const subtypeUpdates = [];
	for(const path of ownedSubtypePhpWasmQualificationChangedPaths)
		subtypeUpdates.push(await transition({
			path
			, previous: git(["show"
				, `${ownedSubtypePhpWasmQualificationPredecessor}:${path}`])
			, current: git(["show"
				, `${ownedSubtypePhpWasmQualificationImplementation}:${path}`])
			, reverse: reverseOwnedSubtypePhpWasmQualificationUpdate
		}));
	const subtypeAdditions = ownedSubtypePhpWasmQualificationAddedPaths.map(path => ({
		path
		, currentSha256: sha256(git(["show"
			, `${ownedSubtypePhpWasmQualificationImplementation}:${path}`]))
	}));
	const subtypeEvidence = subtypeAdditions.find(item =>
		item.path === ownedSubtypePhpWasmQualificationEvidencePath
	);
	assert.ok(subtypeEvidence);
	await writeFile(ownedSubtypePhpWasmQualificationHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-subtype-php-wasm-qualification-v1"
			, predecessorCommit: ownedSubtypePhpWasmQualificationPredecessor
			, implementationCommit: ownedSubtypePhpWasmQualificationImplementation
			, acceptanceEvidence: {
				path: subtypeEvidence.path
				, sha256: subtypeEvidence.currentSha256
			}
			, additions: subtypeAdditions
			, updates: subtypeUpdates
		}, null, 2) + "\n", { flag: "wx" });

	const checkedUpdates = [];
	for(const path of ownedCheckedRecordPhpWasmChangedPaths)
		checkedUpdates.push(await transition({
			path
			, previous: git(["show"
				, `${ownedCheckedRecordPhpWasmPredecessor}:${path}`])
			, current: await readFile(path, "utf8")
			, reverse: reverseOwnedCheckedRecordPhpWasmUpdate
		}));
	const checkedAdditions = [];
	for(const path of ownedCheckedRecordPhpWasmAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordPhpWasmPredecessor, "--", path]).trim(), "", path);
		checkedAdditions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const checkedEvidence = checkedAdditions.find(item =>
		item.path === ownedCheckedRecordPhpWasmEvidencePath
	);
	assert.ok(checkedEvidence);
	await writeFile(ownedCheckedRecordPhpWasmHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-checked-record-php-wasm-v1"
			, predecessorCommit: ownedCheckedRecordPhpWasmPredecessor
			, implementationCommit: ownedCheckedRecordPhpWasmImplementation
			, acceptanceEvidence: {
				path: checkedEvidence.path
				, sha256: checkedEvidence.currentSha256
			}
			, additions: checkedAdditions
			, updates: checkedUpdates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${subtypeUpdates.length} PHP-Wasm owned Subtype and ${checkedUpdates.length} owned checked-record transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}

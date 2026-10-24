/**
 * Authenticate PHP-Wasm owned checked-record qualification and history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOwnedCheckedRecordPhpWasmSource
	, ownedCheckedRecordPhpWasmAddedPaths
	, ownedCheckedRecordPhpWasmChangedPaths
	, ownedCheckedRecordPhpWasmEvidencePath
	, ownedCheckedRecordPhpWasmHistoryPath
	, ownedCheckedRecordPhpWasmImplementation
	, ownedCheckedRecordPhpWasmImplementationPaths
	, ownedCheckedRecordPhpWasmPredecessor
	, reverseOwnedCheckedRecordPhpWasmUpdate
} from "./owned-checked-record-php-wasm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm owned checked-record history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordPhpWasmHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-record-php-wasm-v1");
	assert.equal(record.predecessorCommit, ownedCheckedRecordPhpWasmPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordPhpWasmImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordPhpWasmChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordPhpWasmAddedPaths);
	assert.equal(record.acceptanceEvidence.path
		, ownedCheckedRecordPhpWasmEvidencePath);
	assert.equal(record.acceptanceEvidence.sha256
		, sha256(await readFile(ownedCheckedRecordPhpWasmEvidencePath)));
	for(const update of record.updates)
	{
		// Later layers edit these sources; reconstruct the recorded milestone bytes.
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedCheckedRecordPhpWasmPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseOwnedCheckedRecordPhpWasmUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOwnedCheckedRecordPhpWasmSource(
			update.path, current), previous, update.path);
		assert.equal(beforeOwnedCheckedRecordPhpWasmSource(
			update.path, current, update.currentSha256), current, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("PHP-Wasm owned checked-record implementation range is exact", () => {
	assert.equal(git(["merge-base", ownedCheckedRecordPhpWasmPredecessor
		, ownedCheckedRecordPhpWasmImplementation]).trim()
	, ownedCheckedRecordPhpWasmPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedRecordPhpWasmPredecessor
		, ownedCheckedRecordPhpWasmImplementation]).trim().split("\n").sort()
	, [...ownedCheckedRecordPhpWasmImplementationPaths].sort());
});

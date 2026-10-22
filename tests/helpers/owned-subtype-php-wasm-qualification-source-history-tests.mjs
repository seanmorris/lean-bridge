/**
 * Authenticate the PHP-Wasm owned Subtype qualification transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOwnedSubtypePhpWasmQualificationSource
	, ownedSubtypePhpWasmQualificationAddedPaths
	, ownedSubtypePhpWasmQualificationChangedPaths
	, ownedSubtypePhpWasmQualificationEvidencePath
	, ownedSubtypePhpWasmQualificationHistoryPath
	, ownedSubtypePhpWasmQualificationImplementation
	, ownedSubtypePhpWasmQualificationPredecessor
	, reverseOwnedSubtypePhpWasmQualificationUpdate
} from "./owned-subtype-php-wasm-qualification-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm owned Subtype qualification history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypePhpWasmQualificationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-php-wasm-qualification-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypePhpWasmQualificationPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypePhpWasmQualificationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypePhpWasmQualificationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypePhpWasmQualificationAddedPaths);
	assert.equal(record.acceptanceEvidence.path
		, ownedSubtypePhpWasmQualificationEvidencePath);
	assert.equal(record.acceptanceEvidence.sha256
		, sha256(git(["show"
			, `${ownedSubtypePhpWasmQualificationImplementation}:${ownedSubtypePhpWasmQualificationEvidencePath}`])));
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${ownedSubtypePhpWasmQualificationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${ownedSubtypePhpWasmQualificationPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseOwnedSubtypePhpWasmQualificationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOwnedSubtypePhpWasmQualificationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeOwnedSubtypePhpWasmQualificationSource(
			update.path, current, update.currentSha256), current, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(git(["show"
			, `${ownedSubtypePhpWasmQualificationImplementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm owned Subtype qualification history keeps its commit range", () => {
	assert.equal(git(["merge-base"
		, ownedSubtypePhpWasmQualificationPredecessor
		, ownedSubtypePhpWasmQualificationImplementation]).trim()
	, ownedSubtypePhpWasmQualificationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypePhpWasmQualificationPredecessor
		, ownedSubtypePhpWasmQualificationImplementation]).trim().split("\n").sort()
	, [...ownedSubtypePhpWasmQualificationChangedPaths
		, ...ownedSubtypePhpWasmQualificationAddedPaths].sort());
});

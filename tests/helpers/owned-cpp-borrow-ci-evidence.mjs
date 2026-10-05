/**
 * Authenticate the C++ module inventory repair and immutable execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedRustBorrow, ownedRustBorrowHistoricalBytes } from "./owned-rust-borrow-history.mjs";
import { assertOwnedCppBorrowExecution } from "./owned-cpp-borrow-evidence.mjs";
import { ownedCppBorrowCiBaseline, ownedCppBorrowCiPrevious, ownedCppBorrowCiChangedPaths
	, ownedCppBorrowCiAddedPaths, reverseOwnedCppBorrowCiUpdate } from "./owned-cpp-borrow-ci-history.mjs";

/**
 * Require exact source inventory changes without promoting type support.
 *
 * @param record - The inventory repair receipt.
 */
export const assertOwnedCppBorrowCiRepair = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-borrow-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedCppBorrowCiBaseline);
	assert.deepEqual(record.previous, ownedCppBorrowCiPrevious); assert.equal(record.typeSupportPromotions, 0);
	assert.equal(record.run.command, "node --test --test-concurrency=1 tests/checked-javascript.test.mjs tests/cli-npm-package.test.mjs");
	assert.equal(record.run.exitCode, 0); assert.equal(sha256(record.run.text), record.run.sha256);
	for(const [name, count] of Object.entries({ tests: 8, pass: 8, fail: 0, skipped: 0 }))
		assert.match(record.run.text, new RegExp(`^# ${name} ${count}$`, "mu"));
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedCppBorrowCiAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedRustBorrowHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedCppBorrowCiChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedRustBorrow(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		assert.equal(sha256(reverseOwnedCppBorrowCiUpdate(source, update)), update.previousSha256);
	}
	const module = "src/backends/cpp/owned-borrows.mjs";
	const packageDocument = JSON.parse(await readFile("package.json", "utf8"));
	const configuration = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	assert.deepEqual(packageDocument.files, configuration.files);
	assert.equal(configuration.files.filter(path => path === module).length, 1);
	const disposition = JSON.parse(await readFile("config/checked-javascript.json", "utf8"));
	assert.equal(disposition.deferred.filter(item => item.path === module && item.classification === "strict-migration-backlog").length, 1);
	const index = "docs/type-surface.v1.json", source = beforeOwnedRustBorrow(index, await readFile(index, "utf8")), current = JSON.parse(source);
	const prior = JSON.parse(reverseOwnedCppBorrowCiUpdate(source, record.updates.find(item => item.path === index)));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedRustBorrowHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(current, prior);
	await assertOwnedCppBorrowExecution(previous);
};

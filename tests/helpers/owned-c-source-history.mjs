/**
 * Authenticate the public C/fork-safety transition without rewriting receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedReviewed } from "./owned-reviewed-source-history.mjs";

export const ownedCBaseline = "a2dc55fd307491e20d54731e5ad8da59e4cfc501";
export const ownedCHistoryPath = "docs/evidence/owned-c-integration-20260926.json";
export const ownedCExecutionPath = "docs/evidence/owned-c-execution-20260926.json";
export const ownedCChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md"
	, "docs/evidence/owned-aggregate-metadata-20260926.md"
	, "docs/type-surface.v1.json", "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/native/owned-aggregate-leases.mjs"
	, "src/backends/native/runtime-broker.mjs", "src/build/native-component.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fixtures/structured-types/native-runtime-retirement.c"
	, "tests/fixtures/structured-types/owned-aggregate-leases.c"
	, "tests/helpers/owned-aggregate-native.mjs"
	, "tests/helpers/owned-aggregate-source-history.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/native-runtime-retirement.test.mjs"
	, "tests/owned-aggregate-evidence.test.mjs"
].sort();
export const ownedCAddedPaths = [
	ownedCExecutionPath
	, ...["package", "runtime", "values"].map(name => `src/backends/c/owned-${name}.mjs`)
	, "tests/fixtures/structured-types/owned-public-scalars.c"
	, "tests/fixtures/structured-types/owned-public-values.c"
	, "tests/helpers/owned-c-source-history.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/owned-c-values.test.mjs", "tests/owned-c-evidence.test.mjs"
].sort();
let history;

/**
 * Restore one exact predecessor from authenticated nonoverlapping literal edits.
 *
 * @param source - Current complete source text.
 * @param update - Ordered replacement history and whole-file identities.
 */
export const reverseOwnedCUpdate = (source, update) => {
	assert.ok(ownedCChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length);
	const chunks = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		chunks.push(source.slice(end, edit.start), edit.previous);
		end = edit.start + edit.current.length;
	}
	chunks.push(source.slice(end));
	const previous = chunks.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize only a recorded whole-file identity; unknown drift remains visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional identity at which normalization must stop.
 */
export const beforeOwnedC = (path, source, expected) => {
	source = beforeOwnedReviewed(path, source, expected);
	if(typeof source === "string" && !ownedCChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedCChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedCHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedCUpdate(source, update) : source;
};

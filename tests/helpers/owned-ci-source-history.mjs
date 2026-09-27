/**
 * Preserve original receipts across the owned-value CI contract repairs.
 * Only complete, recorded text identities can be restored.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedCpp, ownedCppChangedPaths } from "./owned-cpp-source-history.mjs";
import { ownedRustChangedPaths } from "./owned-rust-source-history.mjs";
import { ownedPythonChangedPaths } from "./owned-python-source-history.mjs";
import { ownedRubyChangedPaths } from "./owned-ruby-source-history.mjs";
import { ownedDotnetChangedPaths } from "./owned-dotnet-source-history.mjs";

export const ownedCiBaseline = "650641c1274543a334aa7d50c43c70de945984a0";
export const ownedCiHistoryPath = "docs/evidence/owned-ci-repair-20260926.json";
export const ownedCiChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-host-evidence.mjs"
	, "tests/helpers/owned-host-source-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/recursive-acceptance-updates.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-host-evidence.test.mjs"
	, "tests/php-wasm-callable-contract.test.mjs"
].sort();
let history;

/**
 * Restore exact literal edits with complete before/after identity checks.
 *
 * @param source - Complete current text.
 * @param update - Recorded file identities and nonoverlapping ordered edits.
 */
export const reverseOwnedCiUpdate = (source, update) => {
	source = beforeOwnedCpp(update.path, source, update.currentSha256);
	assert.ok(ownedCiChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length);
	const chunks = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		chunks.push(source.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	chunks.push(source.slice(end));
	const previous = chunks.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Unknown paths, bytes and requested current identities are never rewritten.
 *
 * @param path - Exact repository-relative text path.
 * @param source - Complete current or historical source.
 * @param expected - Optional identity at which normalization stops.
 */
export const beforeOwnedCi = (path, source, expected) => {
	source = beforeOwnedCpp(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedCiChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedCiUpdate(source, update) : source;
};

/**
 * Decode only explicitly recorded text paths, preserving arbitrary binary bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete current bytes.
 */
export const ownedCiHistoricalBytes = (path, bytes) => ownedCiChangedPaths.includes(path) || ownedCppChangedPaths.includes(path) || ownedRustChangedPaths.includes(path) || ownedPythonChangedPaths.includes(path) || ownedRubyChangedPaths.includes(path) || ownedDotnetChangedPaths.includes(path)
	? beforeOwnedCi(path, bytes.toString("utf8")) : bytes;

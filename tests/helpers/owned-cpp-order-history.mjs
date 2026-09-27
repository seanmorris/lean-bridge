/**
 * Preserve exact C++ evidence after correcting package inventory order.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedRust, ownedRustChangedPaths } from "./owned-rust-source-history.mjs";
import { ownedPythonChangedPaths } from "./owned-python-source-history.mjs";
import { ownedRubyChangedPaths } from "./owned-ruby-source-history.mjs";

export const ownedCppOrderHistoryPath = "docs/evidence/owned-cpp-inventory-order-20260927.json";
export const ownedCppOrderPaths = [
	"config/cli-package.v1.json", "docs/type-surface.v1.json", "package.json"
	, "tests/helpers/owned-cpp-evidence.mjs"
	, "tests/helpers/owned-cpp-source-history.mjs"
	, "tests/owned-cpp-evidence.test.mjs"
];
let history;

/**
 * Restore only recorded complete identities, leaving unknown bytes unchanged.
 *
 * @param path - Exact manifest or verifier path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional identity at which normalization stops.
 */
export const beforeOwnedCppOrder = (path, source, expected) => {
	source = beforeOwnedRust(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedCppOrderPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedCppOrderHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	if(update?.currentSha256 !== digest) return source;
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const chunks = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current);
		chunks.push(source.slice(end, start), previous); end = start + current.length;
	}
	chunks.push(source.slice(end)); const restored = chunks.join("");
	assert.equal(sha256(restored), update.previousSha256, path);
	return restored;
};

/**
 * Normalize only declared text paths, preserving other bytes exactly.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete file contents.
 */
export const ownedCppOrderHistoricalBytes = (path, bytes) => ownedCppOrderPaths.includes(path) || ownedRustChangedPaths.includes(path) || (ownedPythonChangedPaths.includes(path) || ownedRubyChangedPaths.includes(path))
	? beforeOwnedCppOrder(path, bytes.toString("utf8")) : bytes;

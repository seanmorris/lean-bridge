/**
 * Preserve earlier WIT receipts across the measured loaded-library guard change.
 * Only declared hunks are reversed; unrelated edits remain visible to callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitCompositionIntegration } from "./wit-composition-source-history.mjs";

export const witHostHistoryPath = "docs/evidence/wit-host-isolation-integration-20260924.json";
export const witHostChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/consume/wit-wasi.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/build/native-wit-projection.mjs", "src/release/native-wasi.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/wit-package-evidence.mjs"
	, "tests/helpers/wit-package-source-history.mjs"
	, "tests/wit-graph-package-evidence.test.mjs"
].sort();
let history;

const reverseInventoryEntries = (source, refresh) => {
	for(const entry of refresh.entries)
	{
		const path = entry.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`("path": "${path}",\\n +"sha256": ")${entry.currentSha256}(".*?)`, "g");
		source = source.replace(pattern, `$1${entry.previousSha256}$2`);
	}
	return source;
};

/**
 * Limit inventory refreshes to recorded source identities, with no new claims.
 *
 * @param source - Complete current inventory.
 * @param refresh - Measured predecessor and replacement hashes.
 */
export const reverseWitHostInventory = (source, refresh) => {
	assert.equal(refresh.path, "docs/type-surface.v1.json");
	assert.equal(sha256(source), refresh.currentSha256);
	assert.ok(refresh.entries.length > 0);
	assert.equal(new Set(refresh.entries.map(entry => entry.path)).size, refresh.entries.length);
	for(const entry of refresh.entries)
	{
		assert.ok(Number.isSafeInteger(entry.occurrences) && entry.occurrences > 0);
		const path = entry.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`("path": "${path}",\\n +"sha256": ")${entry.currentSha256}(".*?)`, "g");
		assert.equal([...source.matchAll(pattern)].length, entry.occurrences);
	}
	const previous = reverseInventoryEntries(source, refresh);
	assert.equal(sha256(previous), refresh.previousSha256);
	return previous;
};

/**
 * Check exact whole-file identities on either side of a reversible transition.
 *
 * @param source - Complete post-integration file contents.
 * @param update - Declared predecessor and current source with unique hunks.
 */
export const reverseWitHostUpdate = (source, update) => {
	assert.ok(witHostChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	for(const edit of update.edits.toReversed())
	{
		assert.ok(typeof edit.current === "string" && edit.current.length > 0 && typeof edit.previous === "string");
		assert.equal(source.split(edit.current).length, 2, update.path);
		source = source.replace(edit.current, () => edit.previous);
	}
	assert.equal(sha256(source), update.previousSha256, update.path);
	return source;
};

/**
 * Remove only this integration's known changes before checking older receipts.
 * Callers still compare the complete returned contents with their original hash.
 *
 * @param path - Exact recorded source path.
 * @param source - Entire current or historical source.
 * @param expected - Optional original digest at which normalization stops.
 */
export const beforeWitHostIntegration = (path, source, expected) => {
	source = beforeWitCompositionIntegration(path, source, expected);
	if(sha256(source) === expected || !witHostChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(witHostHistoryPath, "utf8"));
	if(path === "docs/type-surface.v1.json") return reverseInventoryEntries(source, record.inventory);
	for(const update of record.updates.filter(update => update.path === path).toReversed())
	{
		if(sha256(source) === expected) break;
		let previous = source, matched = true;
		for(const edit of update.edits.toReversed())
		{
			if(!edit.current || previous.split(edit.current).length !== 2)
			{ matched = false; break; }
			previous = previous.replace(edit.current, () => edit.previous);
		}
		if(matched) source = previous;
	}
	return source;
};

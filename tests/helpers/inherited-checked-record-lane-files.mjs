/**
 * Authenticated, non-retaining access to one inherited checked-record lane
 * archive. The hash-first pass verifies every indexed file by exact size and
 * SHA-256 without keeping its bytes; each later read re-reads the file and
 * re-verifies it, so no check holds a whole lane in memory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Create the authenticated file view of one lane archive directory.
 *
 * @param read - Repository-relative archive byte reader.
 * @param directory - Repository-relative lane archive directory.
 */
export const inheritedCheckedRecordLaneFiles = (read, directory) => {
	const entries = new Map();
	const load = async entry => {
		const value = Buffer.from(await read(`${directory}/${entry.path}`));
		assert.equal(value.length, entry.bytes, entry.path);
		assert.equal(sha256(value), entry.sha256, entry.path);
		return value;
	};
	return Object.freeze({
		has: path => entries.has(path)
		, keys: () => entries.keys()
		, paths: prefix => [...entries.keys()]
			.filter(path => path.startsWith(prefix))
		, authenticate: async entry => {
			await load(entry);
			entries.set(entry.path, entry);
		}
		, get: async path => {
			const entry = entries.get(path);
			assert.ok(entry, path);
			return load(entry);
		}
	});
};

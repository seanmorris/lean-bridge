/**
 * Reuse the closed historical JVM generator loader under the nested-record evidence vocabulary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { nominalSubtypeJvmGenerator } from "./nominal-subtype-jvm-generators.mjs";

export { nominalSubtypeJvmGenerator as nestedCheckedRecordJvmGenerator };

const sources = new Map();

/**
 * Read a normalized repository path at a full immutable revision.
 *
 * @param revision - Full producer commit.
 * @param path - Repository-relative source path.
 */
export const nestedCheckedRecordJvmOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path)
		&& !path.startsWith("/") && posix.normalize(path) === path
		&& path.split("/").every(part => part && part !== "." && part !== ".."), path);
	const key = `${revision}:${path}`;
	if(!sources.has(key))
		sources.set(key, execFileSync("git", ["show", key], { maxBuffer: 16 * 1024 * 1024 }));
	return Buffer.from(sources.get(key));
};

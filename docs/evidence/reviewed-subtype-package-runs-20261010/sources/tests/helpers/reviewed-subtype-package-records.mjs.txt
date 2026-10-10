/**
 * Retain original author and compiler records before temporary package inputs are removed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Refuse stale output before a producer starts, including when no CI wrapper is used.
 *
 * @param reportPath - Selected report file.
 */
export const createReviewedSubtypePackageRecords = async reportPath => {
	const root = resolve(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS ?? reportPath + ".records");
	await mkdir(dirname(root), { recursive: true });
	await mkdir(root);
	return root;
};

/**
 * Copy selected original bytes without reformatting or dropping partial build records.
 *
 * @param root - Fresh records directory.
 * @param prefix - Selected build directory or empty prefix.
 * @param source - Existing original source directory.
 * @param files - Mapping of retained names to original relative paths.
 */
export const retainReviewedSubtypeFiles = async (root, prefix, source, files) => {
	assert.ok(prefix === "" || /^build-[01]$/u.test(prefix));
	for(const [name, path] of Object.entries(files))
	{
		assert.match(name, /^[A-Za-z0-9_.-]+$/u);
		assert.ok(![".", ".."].includes(name));
		assert.ok(typeof path === "string" && !path.startsWith("/") && path.split("/").every(part => part !== "." && part !== ".."));
		await saveLakeFile(join(root, prefix), name, await readFile(join(source, path)));
	}
};

export const reviewedSubtypeAuthorFiles = Object.freeze({
	"Subtypes.lean": "Subtypes.lean"
	, "lean-bridge.exports.json": "lean-bridge.exports.json"
	, "review.json": "api.binding-ir.json" });

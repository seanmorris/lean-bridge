/**
 * Capture exact files installed from the original receiver release archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Hash regular installed files without following links outside the consumer.
 *
 * @param root - Isolated installed node_modules directory.
 * @param prefix - Current relative directory.
 */
export const ownedJavaScriptReceiverInventory = async (root, prefix = "") => {
	const result = {};
	for(const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name)))
	{
		const path = prefix + entry.name;
		if(entry.isDirectory()) Object.assign(result, await ownedJavaScriptReceiverInventory(root, path + "/"));
		else
		{
			assert.ok(entry.isFile(), path); const bytes = await readFile(join(root, path));
			result[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
	}
	return result;
};

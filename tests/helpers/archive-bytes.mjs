/**
 * Compare binary releases without expanding them into an assertion text diff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

/**
 * Require exact archive bytes and report bounded identities on disagreement.
 *
 * @param left - First independently produced archive buffer.
 * @param right - Second independently produced archive buffer.
 */
export const assertArchiveBytesEqual = (left, right) => {
	assert.ok(Buffer.isBuffer(left) && Buffer.isBuffer(right));
	if(left.equals(right)) return;
	const identity = bytes => `${bytes.length} bytes, SHA-256 ${createHash("sha256").update(bytes).digest("hex")}`;
	assert.fail(`Archive bytes differ: ${identity(left)}; ${identity(right)}`);
};

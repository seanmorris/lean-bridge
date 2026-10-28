/**
 * Rebuild the exact current side of a recorded source transition from its own base commit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { sha256 } from "./source-history-digest.mjs";

/**
 * Apply one recorded update forward to the bytes of its base commit. An integration recorded on a commit that was
 * later rebased or joined is not an ancestor of HEAD, so its current side is rebuilt from the record rather than
 * reversed from the live tree, and both sides are authenticated by their recorded digests.
 *
 * @param base - Commit holding the recorded predecessor.
 * @param update - Recorded transition whose edit offsets address its current side.
 */
export const sourceAtRecordedTransition = (base, update) => {
	assert.match(base, /^[0-9a-f]{40}$/u);
	const previous = execFileSync("git", ["show", `${base}:${update.path}`]
		, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	assert.equal(sha256(previous), update.previousSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0, shift = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		const start = edit.start - shift;
		assert.ok(Number.isSafeInteger(start) && start >= cursor
			&& start <= previous.length, update.path);
		assert.equal(previous.slice(start, start + edit.previous.length)
			, edit.previous, update.path);
		parts.push(previous.slice(cursor, start), edit.current);
		cursor = start + edit.previous.length;
		shift += edit.current.length - edit.previous.length;
	}
	parts.push(previous.slice(cursor));
	const current = parts.join("");
	assert.equal(sha256(current), update.currentSha256, update.path);
	return current;
};

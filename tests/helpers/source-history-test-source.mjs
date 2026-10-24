/**
 * Read one repository source at the exact current side of an authenticated
 * history transition, regardless of later milestones.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

/**
 * Bound shared predecessor and replay text retained between history checks.
 *
 * @param options - Independent limits on entries and UTF-16 text bytes.
 * @param options.maxEntries - Maximum number of cached identities.
 * @param options.maxBytes - Maximum retained key and source bytes.
 */
export const createHistorySourceCache = ({
	maxEntries = 256, maxBytes = 64 * 1024 * 1024
} = {}) => {
	for(const limit of [maxEntries, maxBytes])
		assert.ok(Number.isSafeInteger(limit) && limit >= 0);
	const entries = new Map();
	let retainedBytes = 0;
	const remove = key => {
		const entry = entries.get(key);
		if(entry === undefined) return;
		retainedBytes -= entry.bytes;
		entries.delete(key);
	};
	return {
		/**
		 * Read exact cached text and refresh its recency.
		 *
		 * @param key - Authenticated milestone identity.
		 */
		get: key => {
			const entry = entries.get(key);
			if(entry === undefined) return undefined;
			entries.delete(key);
			entries.set(key, entry);
			return entry.source;
		}
		/**
		 * Retain text only when it fits both cache bounds.
		 *
		 * @param key - Authenticated milestone identity.
		 * @param source - Immutable source text.
		 */
		, set: (key, source) => {
			assert.equal(typeof key, "string");
			assert.equal(typeof source, "string");
			remove(key);
			const bytes = 2 * (key.length + source.length);
			if(maxEntries === 0 || maxBytes === 0 || bytes > maxBytes) return;
			while(entries.size >= maxEntries || retainedBytes + bytes > maxBytes)
				remove(entries.keys().next().value);
			entries.set(key, { source, bytes });
			retainedBytes += bytes;
		}
		, stats: () => ({ size: entries.size, retainedBytes })
	};
};

const milestones = createHistorySourceCache();

/**
 * Read and authenticate the predecessor side of one immutable transition.
 *
 * @param historyPath - Source-history ledger path.
 * @param path - Repository-relative source path.
 */
const previousHistoryMilestone = (historyPath, path) => {
	const key = `previous\0${historyPath}\0${path}`;
	let source = milestones.get(key);
	if(source !== undefined) return source;
	const record = JSON.parse(readFileSync(historyPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	assert.ok(update, `${path} is absent from ${historyPath}`);
	assert.match(record.predecessorCommit, /^[0-9a-f]{40}$/u);
	const primaryPredecessor = update.predecessorCommit
		?? record.predecessorCommit;
	assert.match(primaryPredecessor, /^[0-9a-f]{40}$/u);
	source = execFileSync("git", ["show", `${primaryPredecessor}:${path}`]
		, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	if(sha256(source) !== update.previousSha256)
	{
		assert.equal(update.predecessorCommit, undefined
			, `${historyPath}: explicit predecessor did not match ${path}`);
		const specializedPredecessor = record.generatorPredecessorCommit;
		assert.equal(typeof specializedPredecessor, "string"
			, `${historyPath}: missing specialized predecessor for ${path}`);
		assert.match(specializedPredecessor, /^[0-9a-f]{40}$/u);
		source = execFileSync("git", ["show"
			, `${specializedPredecessor}:${path}`]
		, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	}
	assert.equal(sha256(source), update.previousSha256, historyPath);
	milestones.set(key, source);
	return source;
};

/**
 * Rebuild the current side of one immutable ledger from its recorded Git
 * predecessor. This remains valid when unrelated commits between milestones
 * were never modelled as source-history layers.
 *
 * @param historyPath - Source-history ledger path.
 * @param path - Repository-relative source path.
 */
const replayHistoryMilestone = (historyPath, path) => {
	const key = `replayed\0${historyPath}\0${path}`;
	let source = milestones.get(key);
	if(source !== undefined) return source;
	const record = JSON.parse(readFileSync(historyPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	assert.ok(update, `${path} is absent from ${historyPath}`);
	const previous = previousHistoryMilestone(historyPath, path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		source = previous;
		for(const replacement of update.replacements)
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.previous).length - 1
				, replacement.count, path);
			source = source.replaceAll(
				replacement.previous, replacement.current
			);
		}
		assert.equal(sha256(source), update.currentSha256, historyPath);
		milestones.set(key, source);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let previousCursor = 0; let currentCursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= currentCursor);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		const unchangedLength = edit.start - currentCursor;
		const unchanged = previous.slice(previousCursor
			, previousCursor + unchangedLength);
		assert.equal(unchanged.length, unchangedLength);
		parts.push(unchanged, edit.current);
		previousCursor += unchangedLength;
		assert.equal(previous.slice(previousCursor
			, previousCursor + edit.previous.length), edit.previous);
		previousCursor += edit.previous.length;
		currentCursor = edit.start + edit.current.length;
	}
	parts.push(previous.slice(previousCursor));
	source = parts.join("");
	assert.equal(sha256(source), update.currentSha256, historyPath);
	milestones.set(key, source);
	return source;
};

/**
 * Reconstruct a source at the current side of one recorded milestone.
 *
 * @param historyPath - Source-history ledger path.
 * @param path - Repository-relative source path.
 */
export const sourceAtHistoryMilestone = (historyPath, path) => {
	return replayHistoryMilestone(historyPath, path);
};

/**
 * Replace only source hashes in an independently reconstructed inventory.
 *
 * @param source - Exact historical type-surface document.
 * @param document - Reconstructed type-surface document.
 */
const withSourcePins = (source, document) => {
	const pins = new Map();
	for(const entry of JSON.parse(source).evidence) for(const file of entry.files)
	{
		const previous = pins.get(file.path);
		assert.ok(previous === undefined || previous === file.sha256, file.path);
		pins.set(file.path, file.sha256);
	}
	const result = structuredClone(document);
	for(const entry of result.evidence) for(const file of entry.files)
	{
		const digest = pins.get(file.path);
		if(digest !== undefined) file.sha256 = digest;
	}
	return result;
};

/**
 * Apply exact source pins from the current side of a historical milestone.
 *
 * @param historyPath - Source-history ledger path.
 * @param document - Reconstructed type-surface document.
 */
export const withHistoryMilestoneSourcePins = (historyPath, document) => {
	assert.ok(document && typeof document === "object"
		&& Array.isArray(document.evidence));
	return withSourcePins(sourceAtHistoryMilestone(
		historyPath, "docs/type-surface.v1.json"
	), document);
};

/**
 * Apply the exact source pins from a milestone predecessor to an independently
 * reconstructed inventory. Semantic claims are left untouched.
 *
 * @param historyPath - Source-history ledger path.
 * @param document - Reconstructed type-surface document.
 */
export const withHistorySourcePins = (historyPath, document) => {
	assert.ok(document && typeof document === "object"
		&& Array.isArray(document.evidence));
	const record = JSON.parse(readFileSync(historyPath, "utf8"));
	const path = "docs/type-surface.v1.json";
	const update = record.updates.find(item => item.path === path);
	assert.ok(update, `${path} is absent from ${historyPath}`);
	const source = previousHistoryMilestone(historyPath, path);
	return withSourcePins(source, document);
};

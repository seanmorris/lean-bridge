/**
 * Reconstruct one exact authenticated source-history milestone for verifier
 * tests without making the history hub depend on its own consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const digestPattern = /^[0-9a-f]{64}$/u;
const historyRecords = new Map();
const historyRecordCommits = new Map();
const historySources = new Map();
const pathHistorySources = new Map();
const readerIds = new WeakMap();
const maxHistorySourceBytes = 64 * 1024 * 1024;
let nextReaderId = 1;
let retainedHistorySourceBytes = 0;

const historyRecordCommit = historyPath => {
	if(!historyRecordCommits.has(historyPath))
	{
		const commits = execFileSync("git", ["log", "--diff-filter=A"
			, "--format=%H", "--", historyPath], { encoding: "utf8" })
			.trim().split("\n").filter(Boolean);
		assert.ok(commits.length <= 1
			, `Expected at most one immutable history introduction for ${historyPath}`);
		historyRecordCommits.set(historyPath, commits[0]);
	}
	return historyRecordCommits.get(historyPath);
};

const sourceAtRevision = (revision, path) => {
	try
	{
		return execFileSync("git", ["show", `${revision}:${path}`]
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	}
	catch
	{
		return undefined;
	}
};

const sourceAtPathHistory = (path, expected) => {
	const key = JSON.stringify([path, expected]);
	if(pathHistorySources.has(key)) return pathHistorySources.get(key);
	const revisions = execFileSync("git", [
		"log", "--format=%H", "--", path
	], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
		.trim().split("\n").filter(Boolean);
	for(const revision of revisions)
	{
		const source = sourceAtRevision(revision, path);
		if(source !== undefined && sha256(source) === expected)
		{
			pathHistorySources.set(key, source);
			return source;
		}
	}
	return undefined;
};

/**
 * Read one exact source from the commit that introduced an immutable record.
 *
 * @param historyPath - Repository-relative immutable history record.
 * @param path - Repository-relative source path at that milestone.
 * @param expected - Exact authenticated source SHA-256.
 * @param reader - Optional milestone-specific source reader.
 */
export const sourceAtFinHistoryRecordSource = async (
	historyPath, path, expected, reader = undefined
) => {
	assert.equal(typeof historyPath, "string");
	assert.equal(typeof path, "string");
	assert.match(expected, digestPattern);
	const recordCommit = historyRecordCommit(historyPath);
	const source = recordCommit === undefined
		? await sourceAtFinHistoryMilestone(path, expected, reader)
		: sourceAtRevision(recordCommit, path);
	assert.equal(typeof source, "string", `${historyPath}: missing ${path}`);
	assert.equal(sha256(source), expected, path);
	if(reader !== undefined)
	{
		assert.equal(typeof reader, "function");
		assert.equal(reader(path, source, expected), source
			, `${path} exact immutable-record stop`);
	}
	return source;
};

const sourceAtHistoryRecordEndpoint = async (
	historyPath, record, path, digestField, expected, reader
) => {
	const recordCommit = historyRecordCommit(historyPath);
	const revisions = digestField === "currentSha256"
		? [recordCommit]
		: [record.implementationCommit, record.predecessorCommit
			, recordCommit === undefined ? undefined : `${recordCommit}^`];
	for(const revision of new Set(revisions.filter(Boolean)))
	{
		const source = sourceAtRevision(revision, path);
		if(source === undefined || sha256(source) !== expected) continue;
		assert.equal(reader(path, source, expected), source
			, `${path} exact immutable-record stop`);
		return source;
	}
	return sourceAtFinHistoryMilestone(path, expected, reader);
};

/**
 * Read the live file, reverse the complete history to an exact digest and,
 * when supplied, prove that the milestone-specific reader stops there.
 *
 * This helper is intentionally a leaf: production history readers and the
 * Fin history hub must never import it.
 *
 * @param path - Repository-relative source path.
 * @param expected - Exact authenticated milestone SHA-256.
 * @param reader - Optional milestone-specific source reader.
 */
export const sourceAtFinHistoryMilestone = async (
	path, expected, reader = undefined
) => {
	assert.equal(typeof path, "string");
	assert.match(expected, digestPattern);
	let source = beforeFinRefinementSource(
		path, await readFile(path, "utf8"), expected
	);
	if(sha256(source) !== expected)
		source = sourceAtPathHistory(path, expected) ?? source;
	if(reader !== undefined)
	{
		assert.equal(typeof reader, "function");
		if(sha256(source) !== expected) source = reader(path, source, expected);
		assert.equal(sha256(source), expected, path);
		assert.equal(reader(path, source, expected), source
			, `${path} exact milestone stop`);
	}
	else assert.equal(sha256(source), expected, path);
	return source;
};

/**
 * Reconstruct the update for one path from a named immutable history record.
 * Records are cached, while reconstructed sources remain owned by the caller.
 *
 * @param historyPath - Repository-relative immutable history record.
 * @param path - Updated repository-relative source path.
 * @param reader - Milestone-specific source reader.
 * @param digestField - Record side to reconstruct.
 */
const sourceAtFinHistoryRecordDigest = async (
	historyPath, path, reader, digestField
) => {
	assert.equal(typeof historyPath, "string");
	assert.ok(["currentSha256", "previousSha256"].includes(digestField));
	if(!historyRecords.has(historyPath)) historyRecords.set(
		historyPath, readFile(historyPath, "utf8").then(JSON.parse)
	);
	const record = await historyRecords.get(historyPath);
	assert.ok(Array.isArray(record.updates));
	const matches = record.updates.filter(update => update.path === path);
	assert.equal(matches.length, 1, `Expected one history update for ${path}`);
	if(!readerIds.has(reader)) readerIds.set(reader, nextReaderId++);
	const key = JSON.stringify([
		historyPath, path, matches[0][digestField], readerIds.get(reader)
	]);
	const hit = historySources.get(key);
	if(hit)
	{
		historySources.delete(key);
		historySources.set(key, hit);
		return hit.promise;
	}
	const entry = {
		bytes: 0
		, promise: sourceAtHistoryRecordEndpoint(
			historyPath, record, path, digestField
			, matches[0][digestField], reader
		)
	};
	historySources.set(key, entry);
	try
	{
		const source = await entry.promise;
		const bytes = 2 * (key.length + source.length);
		if(bytes > maxHistorySourceBytes) historySources.delete(key);
		else
		{
			entry.bytes = bytes;
			retainedHistorySourceBytes += bytes;
			while(retainedHistorySourceBytes > maxHistorySourceBytes)
			{
				const oldestKey = historySources.keys().next().value;
				const oldest = historySources.get(oldestKey);
				historySources.delete(oldestKey);
				retainedHistorySourceBytes -= oldest.bytes;
			}
		}
		return source;
	}
	catch(error)
	{
		historySources.delete(key);
		throw error;
	}
};

/**
 * Reconstruct the current side of one path from a named immutable record.
 *
 * @param historyPath - Repository-relative immutable history record.
 * @param path - Updated repository-relative source path.
 * @param reader - Milestone-specific source reader.
 */
export const sourceAtFinHistoryRecord = (historyPath, path, reader) =>
	sourceAtFinHistoryRecordDigest(
		historyPath, path, reader, "currentSha256"
	);

/**
 * Reconstruct the predecessor side of one path from a named immutable record.
 *
 * @param historyPath - Repository-relative immutable history record.
 * @param path - Updated repository-relative source path.
 * @param reader - Milestone-specific source reader.
 */
export const sourceBeforeFinHistoryRecord = (historyPath, path, reader) =>
	sourceAtFinHistoryRecordDigest(
		historyPath, path, reader, "previousSha256"
	);

/**
 * Build a test-local, per-path milestone reader from one authenticated history
 * record. Repeated evidence pins reuse the same reconstruction without keeping
 * sources alive beyond the test that owns the returned closure.
 *
 * @param updates - Exact updates from one source-history record.
 * @param reader - Milestone-specific source reader.
 */
export const finHistoryMilestoneSource = (updates, reader) => {
	assert.ok(Array.isArray(updates) && updates.length > 0);
	assert.equal(typeof reader, "function");
	const byPath = new Map();
	for(const update of updates)
	{
		assert.equal(typeof update?.path, "string");
		assert.match(update.currentSha256, digestPattern);
		assert.ok(!byPath.has(update.path), `Duplicate history path ${update.path}`);
		byPath.set(update.path, update);
	}
	const sources = new Map();
	return async path => {
		const update = byPath.get(path);
		assert.ok(update, `Missing history update for ${path}`);
		if(!sources.has(path)) sources.set(path, sourceAtFinHistoryMilestone(
			path, update.currentSha256, reader
		));
		try
		{
			return await sources.get(path);
		}
		catch(error)
		{
			sources.delete(path);
			throw error;
		}
	};
};

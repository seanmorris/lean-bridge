/**
 * Authenticate Maven prerequisite recovery integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const mavenPrerequisiteHistoryPath = "docs/evidence/maven-prerequisite-source-history-20261010.json";
export const mavenPrerequisitePredecessor = "0fb8f59f5c8d81c6eb3e4ba7bcd8b7797bdb0b24";
export const mavenPrerequisiteChangedPaths = [
	"docs/type-surface.v1.json"
	, "scripts/test-managed-registry-consumers.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-history.mjs"
	, "tests/helpers/reviewed-subtype-native-promotion-tests.mjs"
	, "tests/helpers/type-corpus-jvm-tools.mjs"
	, "tests/native-jvm.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseMavenPrerequisiteUpdate = (source, update) => {
	assert.ok(mavenPrerequisiteChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeMavenPrerequisiteSource = (path, source, expected) => {
	if(typeof source !== "string" || !mavenPrerequisiteChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(mavenPrerequisiteHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseMavenPrerequisiteUpdate(source, update) : source;
};

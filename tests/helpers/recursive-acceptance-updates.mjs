/**
 * Preserve measured sources while consumer tables gain installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitGraphRegistration } from "./wit-graph-source-lineage.mjs";

const filename = "docs/evidence/recursive-managed-acceptance-20260924.json";
const documentation = ["docs/consume/dotnet.md", "docs/consume/java.md", "docs/consume/kotlin.md", "docs/php.md"];
const checker = "tests/helpers/dotnet-current-graph-evidence.mjs";

/** Read the reviewed acceptance index without modifying its historical receipts. */
export const recursiveAcceptanceRecord = () => JSON.parse(readFileSync(filename, "utf8"));

/**
 * Undo only exact reviewed edits; executable documentation examples stay identical.
 *
 * @param source - Entire current file, not a filtered excerpt.
 * @param update - Authenticated predecessor and exact edits.
 */
export const reverseAcceptanceUpdate = (source, update) => {
	source = beforeWitGraphRegistration(update.path, source, update.currentSha256);
	assert.ok(documentation.includes(update.path) || update.path === checker);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(update.edits.length > 0);
	const current = source;
	for(const edit of update.edits.toReversed())
	{
		assert.ok(typeof edit.current === "string" && edit.current.length > 0 && typeof edit.previous === "string");
		assert.equal(source.split(edit.current).length, 2, "Exactly one acceptance update");
		source = source.replace(edit.current, edit.previous);
	}
	assert.equal(sha256(source), update.previousSha256, update.path);
	if(documentation.includes(update.path))
		assert.deepEqual(current.match(/^```[^\n]*\n[\s\S]*?^```/gm), source.match(/^```[^\n]*\n[\s\S]*?^```/gm), "Acceptance must not change executed documentation examples");
	return source;
};

/**
 * Restore a known pre-acceptance source; unknown paths and predecessors reject.
 *
 * @param path - One explicitly reviewed document or receipt checker.
 * @param source - Entire current source.
 * @param expected - Hash retained by the original execution receipt.
 */
export const beforeRecursiveAcceptance = (path, source, expected) => {
	source = beforeWitGraphRegistration(path, source, expected);
	if(sha256(source) === expected) return source;
	const record = recursiveAcceptanceRecord();
	const matches = record.updates.filter(update => update.path === path && update.previousSha256 === expected);
	assert.equal(matches.length, 1, "Unknown acceptance predecessor");
	return reverseAcceptanceUpdate(source, matches[0]);
};

/**
 * Restore documentation by its complete original hash for the prior doc verifier.
 *
 * @param source - Current document, including any unrelated changes.
 * @param expected - Complete pre-acceptance documentation hash.
 */
export const beforeRecursiveAcceptanceDocument = (source, expected) => {
	source = beforeWitGraphRegistration("tests/documentation.test.mjs", source, expected);
	if(sha256(source) === expected) return source;
	const matches = recursiveAcceptanceRecord().updates.filter(update => documentation.includes(update.path) && update.previousSha256 === expected);
	assert.equal(matches.length, 1, "Unknown acceptance documentation");
	return reverseAcceptanceUpdate(source, matches[0]);
};

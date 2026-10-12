/**
 * Authenticate the CLI import repair without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const cliImportRepairHistoryPath = "docs/evidence/cli-import-repair-source-history-20261012.json";
export const cliImportRepairPredecessor = "32d235a179a0aad87f4e709fd6dd1b3bfd26a9dc";
export const cliImportRepairChangedPaths = [
	"config/cli-package.v1.json"
	, "docs/type-surface.v1.json"
	, "tests/cli-npm-package.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/cli-package-config-history-tests.mjs"
	, "tests/helpers/cli-package-config-history.mjs"
	, "tests/helpers/component-engine-closure-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-perl-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-registration-history.mjs"
];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseCliImportRepairUpdate = (source, update) => {
	assert.ok(cliImportRepairChangedPaths.includes(update.path));
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
 * Keep unknown edits and honor exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeCliImportRepairSource = (path, source, expected) => {
	if(typeof source !== "string" || !cliImportRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(cliImportRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCliImportRepairUpdate(source, update) : source;
};

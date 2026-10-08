/**
 * Preserve exact source predecessors of the Bounded browser installation change (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinWitArchiveSource } from "./fin-wit-archive-source-history.mjs";

export const browserInstallHistoryPath = "docs/evidence/browser-install-source-history-20261008.json";
export const browserInstallChangedPaths = [
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, ".github/workflows/demos-pages.yml"
	, "tests/generic-records-browser.test.mjs"
	, "tests/helpers/bounded-apt-tests.mjs"
	, "tests/helpers/owned-callback-result-ci.mjs"
	, "tests/helpers/owned-cpp-callback-result-ci.mjs"
	, "tests/helpers/owned-dotnet-callback-result-ci.mjs"
	, "tests/helpers/owned-javascript-receiver-ci.mjs"
	, "tests/helpers/owned-javascript-wasm-ci.mjs"
	, "tests/helpers/owned-jvm-callback-result-ci.mjs"
	, "tests/helpers/owned-perl-callback-result-ci.mjs"
	, "tests/helpers/owned-perl-callback-result-ci-tests.mjs"
	, "tests/helpers/owned-python-callback-result-ci.mjs"
	, "tests/helpers/owned-ruby-callback-result-ci.mjs"
	, "tests/helpers/owned-rust-callback-result-ci.mjs"
	, "tests/helpers/fin-record-wit-format-source-history.mjs"
	, "tests/helpers/fin-record-wit-format-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseBrowserInstallUpdate = (source, update) => {
	assert.ok(browserInstallChangedPaths.includes(update.path));
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
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeBrowserInstallSource = (path, source, expected) => {
	source = beforeFinWitArchiveSource(path, source, expected);
	if(typeof source !== "string" || !browserInstallChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(browserInstallHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseBrowserInstallUpdate(source, update) : source;
};

/**
 * Preserve main ancestry when integrating .NET entry counters and managed CI prerequisites.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dotnetDispatchIntegrationHistoryPath = "docs/evidence/dotnet-dispatch-integration-source-history-20261009.json";
export const dotnetDispatchIntegrationPredecessor = "04364c407ca07a7c6ad0beec10341da7a8ab8120";
export const dotnetDispatchIntegrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/dotnet-fin.test.mjs"
	, ".github/workflows/consumer-matrix.yml"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/ruby-dispatch-integration-source-history.mjs"
	, "tests/helpers/ruby-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/ruby-gdb-ci-source-history-tests.mjs"
	, "docs/consume/dotnet.md"
	, "docs/consume/ruby.md"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDotnetDispatchIntegrationUpdate = (source, update) => {
	assert.ok(dotnetDispatchIntegrationChangedPaths.includes(update.path));
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
 * Restore the pre-integration source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDotnetDispatchIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !dotnetDispatchIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(dotnetDispatchIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseDotnetDispatchIntegrationUpdate(source, update) : source;
};

/**
 * Preserve main ancestry and the exact Ruby installed-counter producer identity.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const rubyDispatchIntegrationHistoryPath = "docs/evidence/ruby-dispatch-integration-source-history-20261009.json";
export const rubyDispatchIntegrationPredecessor = "93c60a0487d0b2acc0b6d562cd72a3876738a666";
export const rubyDispatchIntegrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/ruby-fin.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/perl-relocated-consumer-source-history.mjs"
	, "tests/helpers/perl-relocated-consumer-source-history-tests.mjs"
	, "docs/consume/ruby.md"
];
export const rubyDispatchIntegrationProducer = "c3bfecb21af56fcc3d4648d305a577730499a516";
export const rubyDispatchIntegrationProducerPins = {
	"tests/ruby-fin.test.mjs": "817b089ecf718de80e5d2fc6d63f03c881e987c7c2bd76734871c5eb4187716c"
};
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseRubyDispatchIntegrationUpdate = (source, update) => {
	assert.ok(rubyDispatchIntegrationChangedPaths.includes(update.path));
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
export const beforeRubyDispatchIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !rubyDispatchIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(rubyDispatchIntegrationHistoryPath, "utf8"));
	if(expected && expected === rubyDispatchIntegrationProducerPins[path])
	{
		assert.equal(record.producerCommit, rubyDispatchIntegrationProducer);
		const producer = record.producerUpdates.find(item => item.path === path && item.previousSha256 === expected);
		if(producer?.currentSha256 === digest) return reverseRubyDispatchIntegrationUpdate(source, producer);
	}
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRubyDispatchIntegrationUpdate(source, update) : source;
};

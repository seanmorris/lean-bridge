/**
 * Authenticate the primitive-base history chain repair: the Ruby promotion layer becomes reachable from
 * every older chain through the Perl promotion layer, the C# ceiling ledger becomes reachable through
 * this layer, and the Nat-fixture Perl promotion check reverses the primitive-base promotion pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeDotnetCeilingSource } from "./nominal-subtype-dotnet-ceiling-history.mjs";

export const primitiveSubtypeHistoryRepairHistoryPath = "docs/evidence/primitive-subtype-history-repair-source-history-20261015.json";
export const primitiveSubtypeHistoryRepairPredecessor = "c4f5e52d1042a8a5e30224ee2b79cc5cf60e316e";
export const primitiveSubtypeHistoryRepairChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-promotion-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-history-tests.mjs"
];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reversePrimitiveSubtypeHistoryRepairUpdate = (source, update) => {
	assert.ok(primitiveSubtypeHistoryRepairChangedPaths.includes(update.path));
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
 * Keep unknown edits and honor exact requested stopping points; the C# ceiling ledger is reversed first
 * because it is the only newer transition of its file.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforePrimitiveSubtypeHistoryRepairSource = (path, source, expected) => {
	source = beforeNominalSubtypeDotnetCeilingSource(path, source, expected);
	if(typeof source !== "string" || !primitiveSubtypeHistoryRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(primitiveSubtypeHistoryRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePrimitiveSubtypeHistoryRepairUpdate(source, update) : source;
};

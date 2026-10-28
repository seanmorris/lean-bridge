/**
 * Preserve prior source identities across the required nominal JVM CI gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeJvmPromotionSource } from "./nominal-subtype-jvm-promotion-history.mjs";

export const nominalSubtypeJvmCiHistoryPath = "docs/evidence/nominal-subtype-jvm-ci-source-history-20261013.json";
export const nominalSubtypeJvmCiPredecessor = "2f38c10b8f0937edeeef39b4e15515f70b66ddd3";
export const nominalSubtypeJvmCiChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-consumer-partition-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-tests.mjs"
	, "tests/helpers/native-fin-jvm-exit-history-tests.mjs"
	, "tests/helpers/native-fin-jvm-exit-history.mjs"
	, "tests/helpers/nominal-subtype-jvm-tests.mjs"
];
let history;

/**
 * Reverse only complete-source transitions with authenticated literal spans.
 *
 * @param source - Complete current source.
 * @param update - Immutable predecessor transition.
 */
export const reverseNominalSubtypeJvmCiUpdate = (source, update) => {
	assert.ok(nominalSubtypeJvmCiChangedPaths.includes(update.path));
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
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Keep unknown changes visible and stop at a requested historical digest.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypeJvmCiSource = (path, source, expected) => {
	source = beforeNominalSubtypeJvmPromotionSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeJvmCiChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeJvmCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeJvmCiUpdate(source, update) : source;
};

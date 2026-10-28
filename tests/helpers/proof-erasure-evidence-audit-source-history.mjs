/**
 * Preserve the exact proof-erasure evidence audit and its hub registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const proofErasureEvidenceAuditHistoryPath
	= "docs/evidence/proof-erasure-evidence-audit-source-history-20261028.json";
export const proofErasureEvidenceAuditPredecessor
	= "4243a9dab1d2f411aaa91770839a6bbf79fabbb5";
export const proofErasureEvidenceAuditImplementation
	= "606b76c7591e9214f44f0ee73fe4d767804187c5";
export const proofErasureEvidenceAuditCommits = Object.freeze([
	"8cdfe4b17d447417aeaff251fb58f9464ad65dcc"
	, "c66419ed5a659803d18c53d890d39df687b93b93"
	, proofErasureEvidenceAuditImplementation
]);
export const proofErasureEvidenceAuditChangedPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-tests.mjs"
	, "tests/helpers/proof-erasure-evidence-audit.mjs"
]);
export const proofErasureEvidenceAuditIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const proofErasureEvidenceAuditNormalizationPaths = Object.freeze([
	...proofErasureEvidenceAuditChangedPaths
	, ...proofErasureEvidenceAuditIntegrationPaths
]);
export const proofErasureEvidenceAuditAddedPaths = Object.freeze([
	"docs/evidence/proof-erasure-retained-audit-20261028.json"
	, "scripts/update-proof-erasure-evidence-audit.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-tests.mjs"
	, "tests/helpers/proof-erasure-evidence-audit.mjs"
	, "scripts/update-proof-erasure-evidence-audit-source-history.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	proofErasureEvidenceAuditHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseProofErasureEvidenceAuditUpdate = (source, update) => {
	assert.ok(proofErasureEvidenceAuditNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove recognized proof-audit transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeProofErasureEvidenceAuditSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !proofErasureEvidenceAuditNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseProofErasureEvidenceAuditUpdate(current, update);
	}
	return current;
};

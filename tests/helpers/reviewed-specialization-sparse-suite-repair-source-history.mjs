/**
 * Preserve the reviewed-specialization sparse-suite separation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedSpecializationSparseSuiteRepairHistoryPath
	= "docs/evidence/reviewed-specialization-sparse-suite-repair-source-history-20261101.json";
export const reviewedSpecializationSparseSuiteRepairPredecessor
	= "dc5625f6ec8679b0ecb8b537a49142cfb0409fa9";
export const reviewedSpecializationSparseSuiteRepairImplementation
	= "855ed16e3becff12d8e1c58e6e6ef7211e839a20";
export const reviewedSpecializationSparseSuiteRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/reviewed-api-promotion-tests.mjs"
		, "tests/reviewed-specializations.test.mjs"
	]);
export const reviewedSpecializationSparseSuiteRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const reviewedSpecializationSparseSuiteRepairHistoryAdditions
	= Object.freeze([
		"scripts/refresh-reviewed-specialization-sparse-suite-repair-pins.mjs"
		, "scripts/update-reviewed-specialization-sparse-suite-repair-source-history.mjs"
		, "tests/helpers/reviewed-specialization-sparse-suite-repair-source-history-tests.mjs"
		, "tests/helpers/reviewed-specialization-sparse-suite-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${reviewedSpecializationSparseSuiteRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const reviewedSpecializationSparseSuiteRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: reviewedSpecializationSparseSuiteRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...reviewedSpecializationSparseSuiteRepairImplementationPaths
	, ...reviewedSpecializationSparseSuiteRepairIntegrationPaths
].includes(path);

/**
 * Assert the sparse runtime/Core evidence separation.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertReviewedSpecializationSparseSuiteRepair = sources => {
	for(const path of reviewedSpecializationSparseSuiteRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const runtime = sources["tests/reviewed-specializations.test.mjs"];
	const promotion
		= sources["tests/helpers/reviewed-api-promotion-tests.mjs"];
	assert.doesNotMatch(runtime
		, /reviewed-specialization-evidence-tests[.]mjs/u);
	assert.equal([...promotion.matchAll(
		/^import "[.]\/reviewed-specialization-evidence-tests[.]mjs";$/gmu
	)].length, 1);
	assert.match(promotion
		, /sparse reviewed-specialization runtime and retained evidence/u);
};

/**
 * Reverse one authenticated sparse-suite repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseReviewedSpecializationSparseSuiteRepairUpdate
	= (source, update) => {
		assert.ok(allowedPath(update.path), update.path);
		assert.equal(sha256(source), update.currentSha256, update.path);
		assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
		let cursor = 0;
		const parts = [];
		for(const edit of update.edits)
		{
			assert.deepEqual(Object.keys(edit).sort()
				, ["current", "previous", "start"]);
			assert.ok(Number.isSafeInteger(edit.start)
				&& edit.start >= cursor && edit.start <= source.length);
			assert.notEqual(edit.previous, edit.current);
			assert.equal(source.slice(edit.start
				, edit.start + edit.current.length), edit.current, update.path);
			parts.push(source.slice(cursor, edit.start), edit.previous);
			cursor = edit.start + edit.current.length;
		}
		parts.push(source.slice(cursor));
		const previous = parts.join("");
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	};

/**
 * Remove only authenticated sparse-suite separation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeReviewedSpecializationSparseSuiteRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !reviewedSpecializationSparseSuiteRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseReviewedSpecializationSparseSuiteRepairUpdate(
				current, update);
	}
	return current;
};

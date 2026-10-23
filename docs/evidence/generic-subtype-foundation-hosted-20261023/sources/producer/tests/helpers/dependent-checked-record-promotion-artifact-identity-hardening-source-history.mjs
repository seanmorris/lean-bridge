/**
 * Reverse the dependent checked-record promotion artifact-identity hardening.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPromotionArtifactIdentityHardeningHistoryPath
	= "docs/evidence/dependent-checked-record-promotion-artifact-identity-hardening-source-history-20261022.json";
export const dependentCheckedRecordPromotionArtifactIdentityHardeningPredecessor
	= "260aed45728b1d6750c68c645d1bca597f2fa9b5";
export const dependentCheckedRecordPromotionArtifactIdentityHardeningImplementation
	= "6afd3282c199418051b7eeb94bd2b2db6160b9a9";
export const dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationBase
	= "6afd3282c199418051b7eeb94bd2b2db6160b9a9";
export const dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths
	= Object.freeze([
		"tests/dependent-checked-record-promotion.test.mjs"
		, "tests/helpers/dependent-checked-record-promotion.mjs"
	]);
export const dependentCheckedRecordPromotionArtifactIdentityHardeningPointerPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, ...dependentCheckedRecordPromotionArtifactIdentityHardeningPointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPromotionArtifactIdentityHardeningHistoryPath, "utf8"));
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore one exact artifact-identity implementation transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordPromotionArtifactIdentityHardeningUpdate
	= (source, update) => reverse(source, update
		, dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths);

/**
 * Restore one exact source-history integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordPromotionArtifactIdentityHardeningIntegration
	= (source, update) => reverse(source, update
		, dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths);

/**
 * Remove this hardening and its exact source-history integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource
	= (path, source, expected) => {
		if(typeof source !== "string") return source;
		const selected = [
			...dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths
			, ...dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths
		];
		if(!selected.includes(path)) return source;
		let digest = sha256(source);
		if(digest === expected) return source;
		const integration = record().integrationUpdates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(integration)
		{
			source = reverseDependentCheckedRecordPromotionArtifactIdentityHardeningIntegration(
				source, integration);
			digest = sha256(source);
			if(digest === expected) return source;
		}
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		return update
			? reverseDependentCheckedRecordPromotionArtifactIdentityHardeningUpdate(
				source, update)
			: source;
	};

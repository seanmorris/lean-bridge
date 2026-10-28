/**
 * Reverse the explicit Perl promotion live-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlPromotionLivePinRepairHistoryPath
	= "docs/evidence/perl-promotion-live-pin-repair-source-history-20261024.json";
export const perlPromotionLivePinRepairPredecessor
	= "473327396bae25615f116e6fa015cbbe73666ed5";
export const perlPromotionLivePinRepairImplementation
	= "7a86ede66ccb114a900762b146c5bca454e363d2";
export const perlPromotionLivePinRepairIntegrationBase
	= "7a86ede66ccb114a900762b146c5bca454e363d2";
export const perlPromotionLivePinRepairCommits = Object.freeze([
	"7a86ede66ccb114a900762b146c5bca454e363d2"
]);
export const perlPromotionLivePinRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const perlPromotionLivePinRepairImplementationAddedPaths = Object.freeze([]);
export const perlPromotionLivePinRepairImplementationPaths = Object.freeze([
	...perlPromotionLivePinRepairChangedPaths
	, ...perlPromotionLivePinRepairImplementationAddedPaths
]);
export const perlPromotionLivePinRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const perlPromotionLivePinRepairNormalizationPaths = Object.freeze([
	...perlPromotionLivePinRepairChangedPaths
	, ...perlPromotionLivePinRepairIntegrationPaths
]);
export const perlPromotionLivePinRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-perl-promotion-live-pin-repair-source-history.mjs"
	, "tests/helpers/perl-promotion-live-pin-repair-source-history-tests.mjs"
	, "tests/helpers/perl-promotion-live-pin-repair-source-history.mjs"
]);
export const perlPromotionLivePinRepairAddedPaths = Object.freeze([
	...perlPromotionLivePinRepairImplementationAddedPaths
	, ...perlPromotionLivePinRepairHistoryAddedPaths
]);

export const perlPromotionLivePinRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/nested-checked-record-perl-promotion-history-tests.mjs"
		, count: 4
		, previousSha256: "16846d74135b62f79a2dffd84721bceb1c1c2deb0150d7133668711c31b0665d"
		, currentSha256: "c31b52e4feb94d59585f8f973111a3003661b5043b8e5206b8248e263c5922b7"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-perl-promotion-history.mjs"
		, count: 4
		, previousSha256: "47da4cc13ebb1967c7e869792a8a3d0330d3cb2e3e48fcc841fab3be53bf586d"
		, currentSha256: "f89f67263d131e3fec68f30ec3854083dd07fe01c7856e9ab9d11adcaa974c33"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-perl-promotion-tests.mjs"
		, count: 4
		, previousSha256: "865abfc6ea5a30ce2eeeaf774a89ae4c50eca4fd0df4ce16de150a32e090fc73"
		, currentSha256: "99df049c52cf1741807243a8030ae8410ae0de39b5a971f351947af43e29ceca"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-perl-promotion.mjs"
		, count: 4
		, previousSha256: "16fde47048456825d3e4d4440fc989531aff5218540f4f75b69bcbf186e7b990"
		, currentSha256: "7512373db9050663c7b89621895119f76ce03298c035696d0a89ab510446a563"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlPromotionLivePinRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePerlPromotionLivePinRepairUpdate = (
	source, update
) => {
	assert.ok(perlPromotionLivePinRepairNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact Perl promotion live-pin repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePerlPromotionLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlPromotionLivePinRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reversePerlPromotionLivePinRepairUpdate(current, update);
	}
	return current;
};

/**
 * Reverse the package-script registrations added by the installed owned-Subtype
 * host milestones, plus the narrow restoration repair that records them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeHostRegistrationHistoryPath
	= "docs/evidence/owned-subtype-host-registration-source-history-20261020.json";
export const ownedSubtypeHostRegistrationPredecessor
	= "a9894a1e50a69bed85a2723d470fe35f08985d03";
export const ownedSubtypeHostRegistrationDraftParent
	= ownedSubtypeHostRegistrationPredecessor;
export const ownedSubtypeHostRegistrationPath = "package.json";
export const ownedSubtypeHostRegistrationEpochs = Object.freeze([
	Object.freeze(["bcb5ff2e62a02d99df0b27a73e2adf82eac5e240"
		, "308fc6a50dfb37e00e2f97f61c2a7d43efdb68c5"])
	, Object.freeze(["308fc6a50dfb37e00e2f97f61c2a7d43efdb68c5"
		, "18804049b371cfe17eaec867c0365fb4b47b8152"])
	, Object.freeze(["18804049b371cfe17eaec867c0365fb4b47b8152"
		, "cf5062772b63ee7483d0a30c2f9df3c01d358157"])
	, Object.freeze(["cf5062772b63ee7483d0a30c2f9df3c01d358157"
		, "a9894a1e50a69bed85a2723d470fe35f08985d03"])
]);
export const ownedSubtypeHostRegistrationChangedPaths = Object.freeze([
	"tests/helpers/owned-refinement-carriers-source-history-tests.mjs"
	, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-transfer-source-history-tests.mjs"
]);
export const ownedSubtypeHostRegistrationAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-host-registration-source-history.mjs"
	, "tests/helpers/owned-subtype-host-registration-source-history.mjs"
	, "tests/owned-subtype-host-registration-history.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeHostRegistrationHistoryPath, "utf8"
));

/**
 * Reverse one authenticated source transition.
 *
 * @param source - Exact source at the later endpoint.
 * @param update - Authenticated reversible edit record.
 */
export const reverseOwnedSubtypeHostRegistrationUpdate = (source, update) => {
	assert.ok(update.path === ownedSubtypeHostRegistrationPath
		|| ownedSubtypeHostRegistrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove this repair and the later host registration layers when their exact
 * digests match. Unknown source is returned unchanged.
 *
 * @param path - Repository-relative source path.
 * @param source - Current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeHostRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const data = record();
	if(ownedSubtypeHostRegistrationChangedPaths.includes(path))
	{
		if(sha256(source) === expected) return source;
		const update = data.updates.find(item => item.path === path);
		if(update?.currentSha256 === sha256(source))
			source = reverseOwnedSubtypeHostRegistrationUpdate(source, update);
		return source;
	}
	if(path !== ownedSubtypeHostRegistrationPath) return source;
	for(const update of [...data.registrations].reverse())
	{
		if(sha256(source) === expected) break;
		if(update.currentSha256 === sha256(source))
			source = reverseOwnedSubtypeHostRegistrationUpdate(source, update);
	}
	return source;
};

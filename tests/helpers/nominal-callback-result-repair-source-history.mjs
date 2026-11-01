/**
 * Preserve the nominal callback-result refinement repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalCallbackResultRepairHistoryPath
	= "docs/evidence/nominal-callback-result-repair-source-history-20261101.json";
export const nominalCallbackResultRepairPredecessor
	= "123a2909ee8c32e5040506e691d855098df19730";
export const nominalCallbackResultRepairImplementation
	= "596229fd294f34417dc7fc2c80a34743703192d7";
export const nominalCallbackResultRepairPinCommit
	= "494d67ccb62bbc974768bcaa42670712b9471d3b";
export const nominalCallbackResultRepairImplementationPaths
	= Object.freeze([
		"src/build/component-structured-callable-adapters.mjs"
		, "tests/component-structured-callable-contract.test.mjs"
	]);
export const nominalCallbackResultRepairPinPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const nominalCallbackResultRepairPinAdditions = Object.freeze([
	"scripts/refresh-nominal-callback-result-pins.mjs"
]);
export const nominalCallbackResultRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const nominalCallbackResultRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-nominal-callback-result-repair-source-history.mjs"
		, "tests/helpers/nominal-callback-result-repair-source-history-tests.mjs"
		, "tests/helpers/nominal-callback-result-repair-source-history.mjs"
	]);

/**
 * Assert that native callback trampolines use the compiler-normalized mirror
 * and reject an invalid nominal result before recovery can hide it.
 *
 * @param adapters - Complete native adapter generator source.
 * @param contract - Complete source-level generator contract.
 */
export const assertNominalCallbackResultRepair = (adapters, contract) => {
	assert.match(adapters
		, /componentStructuredCallableMirrors, componentStructuredCallablePrefix/u);
	assert.match(adapters
		, /const conversion = componentStructuredCallableMirrors\(/u);
	assert.match(adapters
		, /conversion \? conversion[.]refinementsFor\(type[.]id\)/u);
	assert.match(contract
		, /callbackPrefix\}_result_refinement_0.*status = 5/u);
};

const historyUrl = new URL(
	"../../" + nominalCallbackResultRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const nominalCallbackResultRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: nominalCallbackResultRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().pinUpdates.map(update => update.path)
			: nominalCallbackResultRepairPinPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...nominalCallbackResultRepairImplementationPaths
	, ...nominalCallbackResultRepairPinPaths
	, ...nominalCallbackResultRepairIntegrationPaths
].includes(path);

/**
 * Reverse one authenticated nominal callback-result repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseNominalCallbackResultRepairUpdate = (source, update) => {
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
 * Remove only authenticated nominal callback-result repair transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNominalCallbackResultRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalCallbackResultRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates, record().updates
	]){
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNominalCallbackResultRepairUpdate(current, update);
	}
	return current;
};

/**
 * Preserve the non-vacuous nominal C guard ordering repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalGuardDispatchMarkerHistoryPath
	= "docs/evidence/nominal-guard-dispatch-marker-source-history-20261106.json";
export const nominalGuardDispatchMarkerPredecessor
	= "dff17a56acfcf160af12d5254e88bf0a5b82d242";
export const nominalGuardDispatchMarkerImplementation
	= "ec1a258f7fce32c0ebe337b792c4eb7c174f01f9";
export const nominalGuardDispatchMarkerImplementationPaths = Object.freeze([
	"tests/helpers/nominal-subtype-native-tests.mjs"
]);
export const nominalGuardDispatchMarkerIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalGuardDispatchMarkerHistoryAdditions = Object.freeze([
	"scripts/update-nominal-guard-dispatch-marker-source-history.mjs"
	, "tests/helpers/nominal-guard-dispatch-marker-source-history-tests.mjs"
	, "tests/helpers/nominal-guard-dispatch-marker-source-history.mjs"
]);
export const nominalGuardDispatchMarkers = Object.freeze({
	current: Object.freeze([
		"const dispatch = text.indexOf(`lean_object *_lb_checked = ${item.symbol}(`);"
		, "assert.notEqual(first, -1, `${item.publicName}: refinement helper`);"
		, "assert.notEqual(dispatch, -1, `${item.publicName}: Lean dispatch`);"
		, "assert.ok(start !== -1 && start < first && first < dispatch, item.publicName);"
		, "[\"combine\", \"nested\", \"event_first\"].includes(item.publicName)"
		, "assert.deepEqual(guarded.map(item => item.publicName).sort(), [\"combine\", \"event_first\", \"nested\"]);"
		, "assert.throws(() => guardBeforeDispatch(changed, guarded[0]), { name: \"AssertionError\" });"
	])
	, previous: Object.freeze([
		"source.indexOf(`lean_object *checked = ${item.symbol}(`)"
		, "[\"combine\", \"nested\", \"eventFirst\"].includes(item.publicName)"
	])
	, ordering: "body.indexOf(\"lb_fin_below(\") >= 0 && body.indexOf(\"lb_fin_below(\") < body.indexOf(symbol), item.publicName);"
});
export const nominalGuardDispatchMarkerBehavior = Object.freeze({
	markerRepairs: 1, coverageRepairs: 1, guardedExports: 3
	, negativeMutations: 2, livePinRefreshes: 0
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + nominalGuardDispatchMarkerHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const nominalGuardDispatchMarkerNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: nominalGuardDispatchMarkerImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...nominalGuardDispatchMarkerImplementationPaths
	, ...nominalGuardDispatchMarkerIntegrationPaths
].includes(path);
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Bind the current dispatch marker, its existence checks, coverage and mutations.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertNominalGuardDispatchMarkerRepair = sources => {
	const source = sources["tests/helpers/nominal-subtype-native-tests.mjs"];
	assert.equal(typeof source, "string"
		, "tests/helpers/nominal-subtype-native-tests.mjs");
	for(const marker of nominalGuardDispatchMarkers.current)
		assert.equal(count(source, marker), 1, marker);
	for(const marker of nominalGuardDispatchMarkers.previous)
		assert.equal(count(source, marker), 0, marker);
	assert.equal(count(source, nominalGuardDispatchMarkers.ordering), 1
		, "ordering check");
	return { ...nominalGuardDispatchMarkerBehavior };
};

/**
 * Reverse one authenticated guard-marker transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseNominalGuardDispatchMarkerUpdate = (source, update) => {
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
 * Remove only authenticated nominal guard-marker transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNominalGuardDispatchMarkerSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalGuardDispatchMarkerNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNominalGuardDispatchMarkerUpdate(current, update);
	}
	return current;
};

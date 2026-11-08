/**
 * Authenticate the browser-refinement result-direction repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220BrowserRefinementResultDirectionRepairHistoryPath
	= "docs/evidence/vo1220-browser-refinement-result-direction-repair-source-history-20261108.json";
export const vo1220BrowserRefinementResultDirectionRepairPredecessor
	= "99053bf8318bf1d8f05b5abcfabeb21f0f4ba6b1";
export const vo1220BrowserRefinementResultDirectionRepairImplementation
	= "273d242af68f43f42601d33624c25f1ce2cbc8d7";
export const vo1220BrowserRefinementResultDirectionRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/browser-refinement-packages.mjs"
	]);
export const vo1220BrowserRefinementResultDirectionRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220BrowserRefinementResultDirectionRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-browser-refinement-result-direction-repair-source-history.mjs"
		, "tests/helpers/vo1220-browser-refinement-result-direction-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-browser-refinement-result-direction-repair-source-history.mjs"
	]);
export const vo1220BrowserRefinementResultDirectionRepairBehavior
	= Object.freeze({
		downstreamFailures: 1, staleResultConstructorSelections: 1
		, directionalAssertions: 1, diagnosticBoundaries: 1
		, currentSourcePaths: 1, refreshedPins: 1
		, changedSupportCells: 0, runtimeSemanticChanges: 0
	});

const historyUrl = new URL("../../"
	+ vo1220BrowserRefinementResultDirectionRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220BrowserRefinementResultDirectionRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220BrowserRefinementResultDirectionRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220BrowserRefinementResultDirectionRepairIntegrationPaths)
	])].sort());

/**
 * Require host-produced input checking and constructor-free Lean results.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220BrowserRefinementResultDirectionRepair = sources => {
	const source = sources["tests/helpers/browser-refinement-packages.mjs"];
	assert.equal(typeof source, "string");
	assert.match(source
		, /"OnboardingSmall\.echo": \{ parameters: \[refined\("checkedText"\)\], result: copy \}/u);
	assert.doesNotMatch(source
		, /"OnboardingSmall\.echo": \{ parameters: \[refined\("checkedText"\)\], result: refined\("checkedText"\) \}/u);
	assert.match(source
		, /assert\.deepEqual\(echo\.refinements\.result, \{ kind: "subtype", constructor: null \}\)/u);
	assert.match(source
		, /\.catch\(error => assert\.fail\(`\$\{error\.message\}: \$\{JSON\.stringify\(error\.details\)\}`\)\)/u);
	return { ...vo1220BrowserRefinementResultDirectionRepairBehavior };
};

/**
 * Reverse one authenticated repair transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220BrowserRefinementResultDirectionRepairUpdate = (
	source, update
) => {
	assert.ok(vo1220BrowserRefinementResultDirectionRepairNormalizationPaths
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
 * Remove only this exact repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220BrowserRefinementResultDirectionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220BrowserRefinementResultDirectionRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220BrowserRefinementResultDirectionRepairUpdate(
				current, update);
	}
	return current;
};

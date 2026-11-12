/**
 * Preserve the demo site retained-contract scope repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220DemoSiteContractScopeRepairHistoryPath
	= "docs/evidence/vo1220-demo-site-contract-scope-repair-source-history-20261112.json";
export const vo1220DemoSiteContractScopeRepairPredecessor
	= "40157412e4e77f74e84ee7b142385c1fa23a752b";
export const vo1220DemoSiteContractScopeRepairImplementation
	= "a2a897528b1a4b53748a3961e6790d34e963b760";
export const vo1220DemoSiteContractScopeRepairImplementationPaths
	= Object.freeze([
		".github/workflows/demos-pages.yml"
		, "scripts/generate-site-content.mjs"
		, "site/content.test.mjs"
		, "src/adoption/type-surface.mjs"
		, "tests/documentation-demo-api.test.mjs"
	]);
export const vo1220DemoSiteContractScopeRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220DemoSiteContractScopeRepairAddedPaths
	= Object.freeze([
		"scripts/refresh-vo1220-demo-site-contract-scope-repair-pins.mjs"
		, "scripts/update-vo1220-demo-site-contract-scope-repair-source-history.mjs"
		, "tests/helpers/vo1220-demo-site-contract-scope-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-demo-site-contract-scope-repair-source-history.mjs"
	]);
export const vo1220DemoSiteContractScopeRepairNormalizationPaths
	= Object.freeze([
		...vo1220DemoSiteContractScopeRepairImplementationPaths
		, ...vo1220DemoSiteContractScopeRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220DemoSiteContractScopeRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated demo site contract-scope transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220DemoSiteContractScopeRepairUpdate
	= (source, update) => {
		assert.ok(vo1220DemoSiteContractScopeRepairNormalizationPaths
			.includes(update.path), update.path);
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
 * Remove only the authenticated demo site contract-scope repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220DemoSiteContractScopeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220DemoSiteContractScopeRepairNormalizationPaths
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
			current = reverseVo1220DemoSiteContractScopeRepairUpdate(
				current, update);
	}
	return current;
};

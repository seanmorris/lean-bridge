/**
 * Preserve the final-audit registration and static preflight repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFinalAuditRegistrationHistoryPath
	= "docs/evidence/core-final-audit-registration-source-history-20261031.json";
export const coreFinalAuditRegistrationPredecessor
	= "a5fa407aa21e94f0cef429d2387a86c2453f9539";
export const coreFinalAuditRegistrationImplementation
	= "70bb507bf06844d54e3825cc89b690829fe82b97";
export const coreFinalAuditRegistrationTest
	= "core-final-type-surface-audit-source-history";
export const coreFinalAuditRegistrationPins = Object.freeze([
	Object.freeze({
		path: "package.json", count: 25
		, previous: "7dbdcb52ebabdd211955266ab47890b2af0480d1a38ec32e1135116a6d8892e3"
		, current: "9eaac1127c51ee17ad1e194cb43ea8b9bd29192450e58cbbf04e2c63a3ef13f2"
	})
	, Object.freeze({
		path: "src/adoption/test-profiles.mjs", count: 98
		, previous: "885122af68ebbf3d736453265c5b6ef9b6b857844ae4d42981990af12daa2a06"
		, current: "cd2afbdcbd40042ec7bf9b9eb31882d688cb155a970ad8d09f154eb43f748cdb"
	})
	, Object.freeze({
		path: "tests/test-profiles.test.mjs", count: 4
		, previous: "45cceb2be9268b5f4e61e0094ce73e0d70784f827ad6b03b1429754a615cb441"
		, current: "58c3f06ff0e055286894bb4742bd2d69838b81919188f597ee516532827ca512"
	})
]);
export const coreFinalAuditRegistrationImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json", "package.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const coreFinalAuditRegistrationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFinalAuditRegistrationHistoryAdditions = Object.freeze([
	"scripts/update-core-final-audit-registration-source-history.mjs"
	, "tests/helpers/core-final-audit-registration-source-history-tests.mjs"
	, "tests/helpers/core-final-audit-registration-source-history.mjs"
]);

const historyUrl = new URL(`../../${coreFinalAuditRegistrationHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreFinalAuditRegistrationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreFinalAuditRegistrationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreFinalAuditRegistrationImplementationPaths
	.includes(path) || coreFinalAuditRegistrationIntegrationPaths.includes(path);

/**
 * Reverse one exact final-audit registration transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreFinalAuditRegistrationUpdate = (source, update) => {
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
 * Remove only the authenticated final-audit registration repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreFinalAuditRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFinalAuditRegistrationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreFinalAuditRegistrationUpdate(current, update);
	}
	return current;
};

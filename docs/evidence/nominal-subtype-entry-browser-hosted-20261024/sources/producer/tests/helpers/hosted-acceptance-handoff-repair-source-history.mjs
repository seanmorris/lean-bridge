/**
 * Reverse the clean-clone hosted acceptance handoff repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostedAcceptanceHandoffRepairHistoryPath
	= "docs/evidence/hosted-acceptance-handoff-repair-source-history-20261021.json";
export const hostedAcceptanceHandoffRepairPredecessor
	= "81c43306ba2305ed3254198c73f11a9808c38a9e";
export const hostedAcceptanceHandoffRepairImplementation
	= "217d43f0382aeb0c924ad33c8bafa2ea538f308a";
export const hostedAcceptanceHandoffRepairChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-fixture.mjs"
	, "tests/owned-subtype-perl-packaging.test.mjs"
]);
export const hostedAcceptanceHandoffRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-records.test.mjs"
]);
export const hostedAcceptanceHandoffRepairAdditions = Object.freeze([
	"docs/evidence/zero-payload-checked-record-browser-20261021/hosted/logs/engine.log"
	, "docs/evidence/zero-payload-checked-record-browser-20261021/hosted/logs/runtime.log"
	, "docs/evidence/zero-payload-checked-record-native-20261021/hosted/logs/toolchain.log"
	, "docs/evidence/zero-payload-checked-record-perl-20261021/hosted/logs/toolchain.log"
	, "docs/evidence/zero-payload-checked-record-php-20261021/hosted/logs/toolchain.log"
	, "docs/evidence/zero-payload-checked-record-python-20261021/hosted/logs/engine.log"
	, "docs/evidence/zero-payload-checked-record-ruby-20261021/hosted/logs/toolchain.log"
	, "docs/evidence/zero-payload-checked-record-wit-20261021/hosted/logs/toolchain.log"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostedAcceptanceHandoffRepairHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact handoff repair transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseHostedAcceptanceHandoffRepairUpdate = (source, update) => {
	assert.ok([...hostedAcceptanceHandoffRepairChangedPaths
		, ...hostedAcceptanceHandoffRepairIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostedAcceptanceHandoffRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...hostedAcceptanceHandoffRepairChangedPaths
			, ...hostedAcceptanceHandoffRepairIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseHostedAcceptanceHandoffRepairUpdate(source, update)
		: source;
};

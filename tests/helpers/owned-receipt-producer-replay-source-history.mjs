/**
 * Authenticate the exact-producer owned JVM, Perl and PHP receipt replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedReceiptProducerReplayHistoryPath
	= "docs/evidence/owned-receipt-producer-replay-source-history-20261025.json";
export const ownedReceiptProducerReplayPredecessor
	= "6d3b9304a4c06a4ba347eaa4535b2cf26c932a99";
export const ownedReceiptProducerReplayImplementation
	= "0f367903fa0733a5426dd8a5649d195f5fade7c2";
export const ownedReceiptProducerReplayIntegrationBase
	= "0f367903fa0733a5426dd8a5649d195f5fade7c2";
export const ownedReceiptProducerReplayCommits = Object.freeze([
	"0f367903fa0733a5426dd8a5649d195f5fade7c2"
]);
export const ownedReceiptProducerReplayChangedPaths = Object.freeze([
	"tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-acceptance.mjs"
	, "tests/owned-jvm-package-evidence.test.mjs"
	, "tests/owned-php-transfer-evidence.test.mjs"
]);
export const ownedReceiptProducerReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-receipt-producer-replay-tests.mjs"
]);
export const ownedReceiptProducerReplayImplementationPaths = Object.freeze([
	...ownedReceiptProducerReplayChangedPaths
	, ...ownedReceiptProducerReplayImplementationAddedPaths
]);
export const ownedReceiptProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedReceiptProducerReplayNormalizationPaths = Object.freeze([
	...ownedReceiptProducerReplayChangedPaths
	, ...ownedReceiptProducerReplayIntegrationPaths
]);
export const ownedReceiptProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-receipt-producer-replay-source-history.mjs"
	, "tests/helpers/owned-receipt-producer-replay-source-history-tests.mjs"
	, "tests/helpers/owned-receipt-producer-replay-source-history.mjs"
]);
export const ownedReceiptProducerReplayAddedPaths = Object.freeze([
	...ownedReceiptProducerReplayImplementationAddedPaths
	, ...ownedReceiptProducerReplayHistoryAddedPaths
]);
export const ownedReceiptProducerReplayPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/owned-jvm-package-evidence.mjs", count: 0
		, previousSha256: "bd9d67e4305c6dbf8cbf0a92ed8b177159cf33d1854574a462c277f7cc7729ab"
		, currentSha256: "7ca581c4ca7f4f149d0d31110bdfe2edc0bd5e5ecdb2edb94bfd396211f67904"
	})
	, Object.freeze({
		path: "tests/helpers/owned-perl-callback-result-acceptance.mjs", count: 0
		, previousSha256: "cf7a01c89d1ffe3a4b0f71c6ba03a08a9624d9191ec1abd48e8d9d663ea579e4"
		, currentSha256: "9649518925d55a258f57b684a0c50c19e7d9d16bfe4639579a0edc82e648f66a"
	})
	, Object.freeze({
		path: "tests/helpers/owned-perl-callback-result-acceptance-tests.mjs"
		, count: 0
		, previousSha256: "8ae4bbcc9a830de0fc6ab0ed3c17563c8927e0adb1420c80a69fe27fb03940e6"
		, currentSha256: "004c227f67dfff0a1d219e779ea3767bc8c1c814d2962807b4197f1b4166907a"
	})
	, Object.freeze({
		path: "tests/owned-jvm-package-evidence.test.mjs", count: 0
		, previousSha256: "b0f0319cd4b9e83d276051b6bce5d5b34ca27a747c6adbdb65698a4f5d04ed18"
		, currentSha256: "a327c73643300ec54b74702ff11f127f01110465114bfe3c21274342fd7165d1"
	})
	, Object.freeze({
		path: "tests/owned-php-transfer-evidence.test.mjs", count: 0
		, previousSha256: "9f957c147eb0923b534f1ddd2575af377c12dca0d135561defb87989afe3a830"
		, currentSha256: "274ba9c6c9534fad964b28d276fabdd22546f0ef9c1b993757bce1b60ca96575"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedReceiptProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedReceiptProducerReplayUpdate = (
	source, update
) => {
	assert.ok(ownedReceiptProducerReplayNormalizationPaths
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
 * Remove only the exact Owned receipt producer replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedReceiptProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedReceiptProducerReplayNormalizationPaths.includes(path))
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
		current = reverseOwnedReceiptProducerReplayUpdate(current, update);
	}
	return current;
};

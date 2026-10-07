/**
 * Authenticate exact reader repairs without changing historical package receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedCallbackResults, ownedCallbackResultChangedPaths } from "./owned-callback-result-history.mjs";
import { ownedDotnetCallbackChangedPaths } from "./owned-dotnet-callback-result-history.mjs";
import { ownedJvmCallbackChangedPaths } from "./owned-jvm-callback-result-history.mjs";
import { ownedPerlCallbackChangedPaths } from "./owned-perl-callback-result-history.mjs";
import { postPerlCallbackNormalizationPaths } from "./post-perl-callback-staging-history.mjs";
import { witCallbackRuntimeChangedPaths } from "./wit-callback-runtime-staging-history.mjs";
import { perlVariantChangedPaths } from "./owned-perl-callback-result-variant-history.mjs";
import { callbackInventoryRepairPaths } from "./owned-callback-inventory-history.mjs";
import { ownedCppCallbackChangedPaths } from "./owned-cpp-callback-result-history.mjs";
import { ownedRustCallbackChangedPaths } from "./owned-rust-callback-result-history.mjs";
import { ownedPythonCallbackChangedPaths } from "./owned-python-callback-result-history.mjs";
import { ownedRubyCallbackChangedPaths } from "./owned-ruby-callback-result-history.mjs";

export const copiedFixtureReaderHistoryPath = "docs/evidence/copied-fixture-reader-repair-20261002.json";
export const copiedFixtureReaderHistorySha256 = "767d1d2958676ed9018e7a690a96f49be5c709494aa8316b9dc7d09401601dee";
let history, fixtureUpdate;
const readHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(copiedFixtureReaderHistoryPath);
		assert.equal(sha256(bytes), copiedFixtureReaderHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.kind, "copied-fixture-reader-repair");
		assert.equal(history.baselineRevision, "a53368d1bb94f7651cdd571365e8e7a5e6212cd2");
	}
	return history;
};
export const copiedFixtureReaderPaths = Object.freeze([...new Set([
	...readHistory().updates.map(update => update.path)
	, ...ownedCallbackResultChangedPaths
	, ...ownedDotnetCallbackChangedPaths
	, ...ownedJvmCallbackChangedPaths
	, ...ownedPerlCallbackChangedPaths
	, ...postPerlCallbackNormalizationPaths
	, ...witCallbackRuntimeChangedPaths
	, ...perlVariantChangedPaths
	, ...callbackInventoryRepairPaths
	, ...ownedCppCallbackChangedPaths
	, ...ownedRustCallbackChangedPaths
	, ...ownedPythonCallbackChangedPaths
	, ...ownedRubyCallbackChangedPaths
])].sort());

/**
 * Reverse reviewed reader edits only when both complete source identities match.
 *
 * @param source - Complete current reader bytes.
 * @param update - Exact before/after identities and replacement strings.
 */
export const reverseCopiedFixtureReaderUpdate = (source, update) => {
	assert.ok(readHistory().updates.some(entry => entry.path === update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let previous = source.toString();
	for(const edit of [...update.edits].reverse())
	{
		assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		const count = edit.count ?? 1;
		assert.ok(Number.isSafeInteger(count) && count > 0);
		assert.equal(previous.split(edit.current).length, count + 1, update.path);
		previous = previous.replaceAll(edit.current, edit.previous);
	}
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and requested intermediate identities for older readers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source bytes or text.
 * @param expected - Optional stopping digest.
 */
export const beforeCopiedFixtureReaders = (path, source, expected) => {
	source = beforeOwnedCallbackResults(path, source, expected);
	const update = readHistory().updates.find(entry => entry.path === path);
	if(!update) return source;
	const digest = sha256(source);
	return digest !== expected && digest === update.currentSha256
		? reverseCopiedFixtureReaderUpdate(source, update) : source;
};

/**
 * Admit the recorded WIT fixture change and exact reader upgrades, nothing else.
 *
 * @param path - Historical source path.
 * @param bytes - Current or historical source bytes.
 * @param expected - Requested historical SHA-256.
 */
export const copiedFixtureHistoricalBytes = (path, bytes, expected) => {
	const source = beforeCopiedFixtureReaders(path, bytes, expected);
	const { fixture } = readHistory();
	if(path !== fixture.path || sha256(source) === expected) return source;
	if(sha256(source) !== fixture.currentSha256) return source;
	if(!fixtureUpdate)
	{
		const receiptBytes = readFileSync(fixture.receipt);
		assert.equal(sha256(receiptBytes), fixture.receiptSha256);
		const receipt = JSON.parse(receiptBytes);
		assert.equal(receipt.acceptance, "passed");
		assert.equal(receipt.kind, "wit-owned-receivers");
		fixtureUpdate = receipt.updates.find(update => update.path === fixture.path);
		assert.equal(fixtureUpdate.previousSha256, fixture.previousSha256);
		assert.equal(fixtureUpdate.currentSha256, fixture.currentSha256);
	}
	const text = source.toString(); let end = 0; const parts = [];
	for(const { start, current, previous } of fixtureUpdate.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(text.slice(start, start + current.length), current);
		parts.push(text.slice(end, start), previous); end = start + current.length;
	}
	parts.push(text.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), fixture.previousSha256);
	return previous;
};

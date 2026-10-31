/**
 * Preserve the final downstream disk and audit-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finalDownstreamResourceHistoryPath
	= "docs/evidence/final-downstream-resource-source-history-20261031.json";
export const finalDownstreamResourcePredecessor
	= "cced2247d5cb9281515986ca623ab09edec00788";
export const finalDownstreamResourceImplementation
	= "0d03568b18d8d87261b19896ec55bfc70c7e1fe6";
export const finalDownstreamResourcePins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/consumer-matrix.yml", count: 92
		, previous: "23ebcb533f770f297227fb9ae8c554056f604d27548e1252eed8b0b1a1decc9f"
		, current: "b2b54c778b971a195b5568d7321cd008ff469e1e4ea9563e57e946236aa30162"
	})
	, Object.freeze({
		path: "tests/documentation.test.mjs", count: 25
		, previous: "994ac84d37aa8ba33375c439323c1a666a2a8f1a21a7eb935b7e537f6d821847"
		, current: "46e2b1ae429c45758085bcff5687f8a835a319fa8cc4ae4498270408a97b34c4"
	})
]);
export const finalDownstreamResourceImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs", "tests/type-corpus-reviewed.test.mjs"
]);
export const finalDownstreamResourceIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const finalDownstreamResourceHistoryAdditions = Object.freeze([
	"scripts/update-final-downstream-resource-source-history.mjs"
	, "tests/helpers/final-downstream-resource-source-history-tests.mjs"
	, "tests/helpers/final-downstream-resource-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + finalDownstreamResourceHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const finalDownstreamResourceNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: finalDownstreamResourceImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => finalDownstreamResourceImplementationPaths
	.includes(path) || finalDownstreamResourceIntegrationPaths.includes(path);

/**
 * Reverse one exact final downstream resource transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseFinalDownstreamResourceUpdate = (source, update) => {
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
 * Remove only the authenticated final downstream resource transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeFinalDownstreamResourceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finalDownstreamResourceNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseFinalDownstreamResourceUpdate(current, update);
	}
	return current;
};

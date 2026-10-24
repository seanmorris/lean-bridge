/**
 * Authenticate pre-promotion inputs while testing the current implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { genericSubtypeDocumentationPaths } from "./generic-subtype-documentation.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { gitSourceBytes, readSmallHistorySource } from "./source-history-stream.mjs";

export const genericSubtypePromotionBaselineCommit
	= "6d5f926512919c6660dc369c9e36697da5dd5d3b";
export const genericSubtypePromotionBaselinePath
	= "docs/evidence/generic-subtype-promotion-baseline-20261024.json";
const paths = [
	"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
	, "docs/consumer-support.v1.json"
	, ...Object.values(genericSubtypeDocumentationPaths)
];

/**
 * Reject changed baseline identities, incomplete selections and unsafe paths.
 *
 * @param record - Exact immutable input selection.
 */
export const assertGenericSubtypePromotionBaseline = record => {
	assert.deepEqual(Object.keys(record).sort(), ["kind", "schemaVersion", "sourceCommit", "sources"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "generic-subtype-promotion-regression-baseline-v1");
	assert.equal(record.sourceCommit, genericSubtypePromotionBaselineCommit);
	assert.deepEqual(record.sources.map(source => source.path), paths);
	for(const source of record.sources)
	{
		assert.deepEqual(Object.keys(source).sort(), ["bytes", "path", "sha256"]);
		assert.ok(Number.isSafeInteger(source.bytes) && source.bytes > 0);
		assert.match(source.sha256, /^[a-f0-9]{64}$/u);
	}
	return record;
};

const record = assertGenericSubtypePromotionBaseline(JSON.parse(
	await readFile(genericSubtypePromotionBaselinePath, "utf8")));

/**
 * Read one authenticated small baseline source from its immutable Git object.
 *
 * @param path - One of the closed schema/documentation paths.
 * @param selection - Optional baseline selection for refusal controls.
 */
export const genericSubtypePromotionBaselineText = async (path, selection = record) => {
	assertGenericSubtypePromotionBaseline(selection);
	assert.ok(path !== "docs/type-surface.v1.json" && paths.includes(path));
	return readSmallHistorySource(gitSourceBytes(selection.sourceCommit, path)
		, selection.sources.find(source => source.path === path));
};

/**
 * Stream the full original inventory through the live validator and compare
 * its byte identity to the immutable baseline. No large JSON clone is needed.
 *
 * @param contracts - Authenticated baseline IR schema and consumer contract.
 */
export const genericSubtypePromotionBaselineInventory = async contracts => {
	const original = record.sources[0];
	const inventory = await readPromotionInventory(
		gitSourceBytes(record.sourceCommit, original.path), contracts);
	assert.deepEqual(inventory.source, { bytes: original.bytes, sha256: original.sha256 });
	return inventory.document;
};

/**
 * Read the fourteen original inputs, not an old copy of the renderer.
 */
export const genericSubtypePromotionBaselineDocumentation = async () => {
	const sources = {};
	for(const [name, path] of Object.entries(genericSubtypeDocumentationPaths))
		sources[name] = await genericSubtypePromotionBaselineText(path);
	return sources;
};

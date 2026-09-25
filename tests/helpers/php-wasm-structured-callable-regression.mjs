/**
 * Preserve complete Zend outputs for every previously admitted copied family.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedPhpZendAdapter } from "../../src/backends/php/copied-zend.mjs";
import { phpStructuredRegressionFixtures } from "./php-structured-callable-regression.mjs";

export const phpWasmStructuredCodegenSources = [
	"src/backends/php/copied-zend-conversions.mjs"
	, "src/backends/php/copied-zend-support.mjs"
	, "src/backends/php/copied-zend.mjs"
	, "src/backends/php/zend-callables.mjs"
];

/**
 * Compare every generated file at both integer widths, including primitive callbacks.
 *
 * @param record - Source-bound independent predecessor and current generations.
 */
export const assertPhpWasmStructuredCodegenRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-wasm-structured-codegen-regression");
	assert.equal(record.baselineRevision, "89c43a33eb639bc8a2ca19df697ba56e9cfacae9");
	assert.deepEqual(Object.keys(record.predecessors), phpWasmStructuredCodegenSources);
	assert.deepEqual(Object.keys(record.sourceHashes), phpWasmStructuredCodegenSources);
	assert.deepEqual(record.fixtures.map(({ name, integerBits }) => [name, integerBits]),
		Object.keys(phpStructuredRegressionFixtures).flatMap(name => [32, 64].map(integerBits => [name, integerBits])));
	for(const fixture of record.fixtures)
	{
		const ir = phpStructuredRegressionFixtures[fixture.name]();
		assert.equal(fixture.bindingIrSha256, sha256(canonicalJson(ir)));
		const files = generateCopiedPhpZendAdapter(ir, { integerBits: fixture.integerBits });
		assert.deepEqual(fixture.files, Object.fromEntries(Object.entries(files).map(([path, source]) =>
			[path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		assert.equal(fixture.identicalToPredecessor, true);
	}
};

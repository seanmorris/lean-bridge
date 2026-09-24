/**
 * Preserve every generated file for previously admitted Rust copied fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { rustCallableSignatures } from "./rust-callable-fixture.mjs";
import { collectionReviewedIr } from "./collection-fixture.mjs";
import { compoundReviewedIr } from "./compound-source-fixture.mjs";
import { listReviewedIr } from "./list-fixture.mjs";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { cVariantReviewedIr } from "./c-variant-fixture.mjs";

export const rustStructuredRegressionFixtures = {
	callables: () => callableReviewedIr(rustCallableSignatures)
	, collections: collectionReviewedIr, compounds: compoundReviewedIr
	, lists: listReviewedIr
	, aliases: nativeAliasReviewedIr
	, variants: cVariantReviewedIr
};

/**
 * Check generated files against the independently rendered predecessor revision.
 *
 * @param record - Frozen source identities and generated-file observations.
 */
export const assertRustStructuredCodegenRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "rust-structured-codegen-regression");
	assert.equal(record.baselineRevision, "646aceda428705779adc34a2b96a0c0dcd7356b5");
	assert.deepEqual(record.fixtures.map(item => item.name), Object.keys(rustStructuredRegressionFixtures));
	for(const fixture of record.fixtures)
	{
		const ir = rustStructuredRegressionFixtures[fixture.name]();
		assert.equal(fixture.bindingIrSha256, sha256(canonicalJson(ir)));
		const files = generateCopiedRustPackage(ir);
		assert.deepEqual(fixture.files, Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		assert.equal(fixture.identicalToPredecessor, true);
	}
};

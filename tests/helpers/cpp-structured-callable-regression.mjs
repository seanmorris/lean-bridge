/**
 * Preserve generated C++ packages for all previously admitted copied fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { cppCallableSignatures } from "./cpp-callable-fixture.mjs";
import { collectionReviewedIr } from "./collection-fixture.mjs";
import { compoundReviewedIr } from "./compound-source-fixture.mjs";
import { listReviewedIr } from "./list-fixture.mjs";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { cVariantReviewedIr } from "./c-variant-fixture.mjs";

export const cppStructuredRegressionFixtures = {
	callables: () => callableReviewedIr(cppCallableSignatures)
	, collections: collectionReviewedIr, compounds: compoundReviewedIr
	, lists: listReviewedIr
	, aliases: nativeAliasReviewedIr
	, variants: cVariantReviewedIr
};

/**
 * Check every generated file against the independently rendered predecessor.
 *
 * @param record - Original revision and complete generated-file identities.
 */
export const assertCppStructuredCodegenRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "cpp-structured-codegen-regression");
	assert.equal(record.baselineRevision, "9e6eb510535a6907c37d63f89ecbe0ac66927c32");
	assert.deepEqual(record.fixtures.map(item => item.name), Object.keys(cppStructuredRegressionFixtures));
	for(const fixture of record.fixtures)
	{
		const ir = cppStructuredRegressionFixtures[fixture.name]();
		assert.equal(fixture.bindingIrSha256, sha256(canonicalJson(ir)));
		const files = generateCppBindingPackage(ir);
		assert.deepEqual(fixture.files, Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		assert.equal(fixture.identicalToPredecessor, true);
	}
};

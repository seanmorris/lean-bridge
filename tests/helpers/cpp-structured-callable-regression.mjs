/**
 * Preserve generated C++ packages for all previously admitted copied fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { cppCallableSignatures } from "./cpp-callable-fixture.mjs";
import { collectionReviewedIr } from "./collection-fixture.mjs";
import { compoundReviewedIr } from "./compound-source-fixture.mjs";
import { listReviewedIr } from "./list-fixture.mjs";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { cVariantReviewedIr } from "./c-variant-fixture.mjs";
import { moduleAtProducer } from "./producer-module.mjs";

export const cppStructuredRegressionFixtures = {
	callables: () => callableReviewedIr(cppCallableSignatures)
	, collections: collectionReviewedIr, compounds: compoundReviewedIr
	, lists: listReviewedIr
	, aliases: nativeAliasReviewedIr
	, variants: cVariantReviewedIr
};
export const cppStructuredCodegenProducer
	= "646aceda428705779adc34a2b96a0c0dcd7356b5";

/**
 * Check every generated file against the independently rendered predecessor.
 *
 * @param record - Original revision and complete generated-file identities.
 */
export const assertCppStructuredCodegenRegression = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "cpp-structured-codegen-regression");
	assert.equal(record.baselineRevision, "9e6eb510535a6907c37d63f89ecbe0ac66927c32");
	const producer = await moduleAtProducer(
		cppStructuredCodegenProducer, "src/backends/cpp/generate.mjs");
	assert.deepEqual(record.fixtures.map(item => item.name), Object.keys(cppStructuredRegressionFixtures));
	for(const fixture of record.fixtures)
	{
		const ir = cppStructuredRegressionFixtures[fixture.name]();
		assert.equal(fixture.bindingIrSha256, sha256(canonicalJson(ir)));
		const files = producer.generateCppBindingPackage(ir);
		assert.deepEqual(fixture.files, Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		assert.equal(fixture.identicalToPredecessor, true);
	}
};

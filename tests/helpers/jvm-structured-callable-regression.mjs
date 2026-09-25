/**
 * Preserve generated Java/Kotlin files for all previously accepted copied APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedJvmKotlinPackage } from "../../src/backends/jvm/copied-kotlin.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { jvmCallableSignatures } from "./jvm-callable-fixture.mjs";
import { collectionReviewedIr } from "./collection-fixture.mjs";
import { compoundReviewedIr } from "./compound-fixture.mjs";
import { listReviewedIr } from "./list-fixture.mjs";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { nativeVariantReviewedIr } from "./native-variant-fixture.mjs";

export const jvmStructuredRegressionFixtures = {
	callables: () => callableReviewedIr(jvmCallableSignatures)
	, collections: collectionReviewedIr, compounds: compoundReviewedIr
	, lists: listReviewedIr, aliases: nativeAliasReviewedIr
	, variants: nativeVariantReviewedIr
};

/**
 * Compare all emitted files to separately generated predecessor observations.
 *
 * @param record - Frozen source identities and generated-file hashes.
 */
export const assertJvmStructuredCodegenRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "jvm-structured-codegen-regression");
	assert.match(record.baselineRevision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(record.fixtures.map(item => item.name), Object.keys(jvmStructuredRegressionFixtures));
	for(const fixture of record.fixtures)
	{
		const ir = jvmStructuredRegressionFixtures[fixture.name]();
		assert.equal(fixture.bindingIrSha256, sha256(canonicalJson(ir)));
		const files = generateCopiedJvmKotlinPackage(ir);
		assert.deepEqual(fixture.files, Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		assert.equal(fixture.identicalToPredecessor, true);
	}
};

/**
 * Validate compiler-checked review evidence before counting installed cases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { validateReviewedSource, verifyReviewedSourceInputs } from "../../src/analyze/reviewed-source.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/**
 * Require review, source, compiler, receipt, oracle and model agreement.
 *
 * @param run - Installed native corpus observation.
 * @param library - Independently specified corpus library.
 */
export const validateReviewedCorpusBuild = (run, library) => {
	const { reviewed } = run;
	assert.deepEqual(Object.keys(reviewed).sort(), ["inputs", "metadata", "model", "receipt"]);
	const { model, metadata, receipt, inputs } = reviewed;
	const identity = model.sourceIdentity;
	assert.equal(model.schemaVersion, 3);
	assert.deepEqual(validateReviewedSource(identity.reviewedBindingIr), corpusReviewedIr(library));
	assert.deepEqual(receipt.sourceIdentity, identity);
	assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
	assert.equal(receipt.modelSha256, run.declarationEvidence.modelSha256);
	assert.equal(receipt.metadataSha256, sha256(canonicalJson(metadata)));
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.equal(receipt.runtimeIdentity, run.runtimeIdentity);
	assert.equal(hashBindingIr(model.bindingIr), run.bindingIrSha256);
	assert.equal(model.bindingIrSha256, run.bindingIrSha256);
	assert.equal(identity.sourceTreeSha256, run.sourceTreeSha256);
	assert.equal(identity.sourceTreeSha256, sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")));
	assert.equal(identity.lakeDependencies.snapshotSha256, run.lakeSnapshotSha256);
	assert.equal(identity.leanCompilerSha256, run.oracleEvidence.leanCompilerSha256);
	assert.equal(identity.leanVersion, "4.32.2");
	assert.equal(identity.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	for(const module of identity.modules)
		assert.equal(module.source.sha256, run.oracleEvidence.modules.find(input => input.module === module.module)?.sha256);
	assert.equal(run.independentBuilds, 2);
	assert.equal(run.isolation.sourcesRemovedBeforeInstall, true);
	assert.equal(run.isolation.offlineInstall, true);
	assert.equal(run.isolation.compilerPathDisabled, true);
	verifyReviewedSourceInputs(identity, inputs);
	assert.deepEqual(createNativeModel({ metadata, component: model.component
		, moduleName: model.moduleName, sourceIdentity: identity }), model);
};

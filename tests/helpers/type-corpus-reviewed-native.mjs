/**
 * Validate compiler-checked review evidence before counting installed cases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { createNativeModel, createPhpWasmCopiedModel } from "../../src/build/native-model.mjs";
import { validateReviewedSource, verifyReviewedSourceInputs } from "../../src/analyze/reviewed-source.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { compilerProjectAnalysis, validateCompilerProjectAnalysis } from "../../src/analyze/project-analysis.mjs";
import { corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const validateScalar = (run, library) => {
	const { reviewed } = run;
	assert.deepEqual(Object.keys(reviewed).sort(), ["elaboration", "intent", "inventory", "ir", "receipt"]);
	const { elaboration, intent, inventory, ir, receipt } = reviewed;
	const signatures = corpusSignatures(library).filter(item => [...item.parameters, item.result].every(type => typeof type === "string"));
	assert.deepEqual(validateReviewedSource(elaboration.reviewedBindingIr), corpusReviewedIr(library, signatures));
	assert.equal(intent.lakeSnapshot.sha256, sha256(canonicalJson(intent.lakeSnapshot.document)));
	assert.equal(elaboration.snapshotSha256, run.lakeSnapshotSha256);
	assert.equal(elaboration.snapshotSha256, intent.lakeSnapshot.sha256);
	assert.equal(elaboration.leanCompilerSha256, run.compilerSha256);
	assert.equal(sha256(canonicalJson(elaboration)), run.declarationEvidence.modelSha256);
	assert.equal(inventory.sourceTreeSha256, run.sourceTreeSha256);
	assert.equal(inventory.sourceTreeSha256, sha256(inventory.inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")));
	const analysis = compilerProjectAnalysis(inventory, intent.document.modules, elaboration);
	validateCompilerProjectAnalysis(analysis, inventory, intent);
	assert.deepEqual(analysis.bindingIr.document, ir);
	assert.equal(analysis.bindingIr.origin, "lean-elaborated");
	assert.equal(hashBindingIr(ir), run.bindingIrSha256);
	assert.equal(receipt.bindingIrSha256, run.bindingIrSha256);
	assert.equal(sha256(canonicalJson(receipt)), run.receiptSha256);
	assert.equal(receipt.package.sha256, run.archiveSha256);
	assert.equal(receipt.runtime.sha256, run.runtimeArchive.sha256);
	assert.equal(receipt.source.treeSha256, run.sourceTreeSha256);
	assert.equal(analysis.adapterHints.length, 0);
	assert.ok(analysis.diagnostics.every(item => item.severity !== "error"));
	for(const module of elaboration.metadata.modules)
		assert.equal(module.sourceSha256, run.oracleEvidence.modules.find(input => input.module === module.name)?.sha256);
};

/**
 * Require review, source, compiler, receipt, oracle and model agreement.
 *
 * @param run - Installed native corpus observation.
 * @param library - Independently specified corpus library.
 */
export const validateReviewedCorpusBuild = (run, library) => {
	assert.equal(run.independentBuilds, 2);
	assert.equal(run.isolation.sourcesRemovedBeforeInstall, true);
	assert.equal(run.isolation.offlineInstall, true);
	assert.equal(run.isolation.compilerPathDisabled, true);
	if(run.profile.startsWith("node-") || run.profile.startsWith("browser-")) return validateScalar(run, library);
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
	const createModel = run.profile === "php-wasm" ? createPhpWasmCopiedModel : createNativeModel;
	assert.equal(model.profile, run.profile === "php-wasm" ? "php-wasm-copied-v1" : "native-library-v1");
	assert.deepEqual(createModel({ metadata, component: model.component
		, moduleName: model.moduleName, sourceIdentity: identity }), model);
};

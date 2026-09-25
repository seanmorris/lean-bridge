/**
 * Compare complete WIT outputs and the shared native C adapter with predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../../src/backends/wit/copied-host.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { witCallableSignatures } from "./wit-callable-fixture.mjs";
import { rustStructuredRegressionFixtures } from "./rust-structured-callable-regression.mjs";
import { perlStructuredRegressionModels, perlStructuredContractModels } from "./perl-structured-callable-regression.mjs";

export const witStructuredCodegenSources = [
	"src/backends/c/native-callables.mjs"
	, "src/backends/wit/callable-host.mjs"
	, "src/backends/wit/copied-aliases.mjs"
	, "src/backends/wit/copied-model.mjs"
];
export const witStructuredRegressionFixtures = {
	...rustStructuredRegressionFixtures, callables: () => callableReviewedIr(witCallableSignatures)
};
export const witStructuredNativeReceipt = { initializer: "initialize_LeanBridgeNative0123456789abcdef" };
const identity = files => Object.fromEntries(Object.entries(files).map(([path, source]) =>
	[path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }]));

/**
 * Include the whole public C package, canonical component and native host source.
 *
 * @param ir - Independent previously admitted copied contract.
 */
export const witStructuredGeneratedFiles = ir => {
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	return { ...generateCBindingPackage(ir)
		, "model.wit": model.wit, "model.wat": model.wat
		, "wit-binding-manifest.json": canonicalJson(model.manifest)
		, "host.h": renderWitHostHeader(model)
		, "host.c": renderWitHostSource(model, new Uint8Array([0])) };
};

/** Retain ordinary copied families and each callback direction separately. */
export const witStructuredNativeModels = () => {
	const models = Object.fromEntries(Object.entries(perlStructuredRegressionModels).map(([name, fixture]) => [name, fixture()]));
	for(const position of ["parameter", "result"])
		for(const [shape, model] of Object.entries(perlStructuredContractModels(position))) models[`${shape}-${position}`] = model;
	return models;
};

/**
 * Authenticate unchanged outputs and the two previously broken alias cases.
 * These synthetic checks supplement the installed Lean and Wasmtime consumers.
 *
 * @param record - Independently generated predecessor and current observations.
 */
export const assertWitStructuredCodegenRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-structured-codegen-regression");
	assert.match(record.baselineRevision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(record.predecessors), witStructuredCodegenSources);
	assert.deepEqual(Object.keys(record.sourceHashes), witStructuredCodegenSources);
	assert.deepEqual(record.wit.map(item => item.name), Object.keys(witStructuredRegressionFixtures));
	for(const fixture of record.wit)
	{
		const ir = witStructuredRegressionFixtures[fixture.name]();
		assert.equal(fixture.bindingIrSha256, sha256(canonicalJson(ir)));
		assert.deepEqual(fixture.files, identity(witStructuredGeneratedFiles(ir)));
		assert.equal(fixture.identicalToPredecessor, true);
	}
	const models = witStructuredNativeModels();
	assert.deepEqual(record.native.map(item => item.name), Object.keys(models));
	for(const fixture of record.native)
	{
		const model = models[fixture.name];
		assert.equal(fixture.modelSha256, sha256(canonicalJson(model)));
		assert.deepEqual(fixture.files, identity({ "native.c": generateNativePrimitiveC(model, witStructuredNativeReceipt) }));
		const repaired = ["alias-parameter", "alias-result"].includes(fixture.name);
		assert.equal(fixture.identicalToPredecessor, !repaired);
		if(repaired) assert.equal(fixture.previousFailure, "Cannot read properties of undefined (reading 'name')");
		else assert.equal(fixture.previousFailure, undefined);
	}
};

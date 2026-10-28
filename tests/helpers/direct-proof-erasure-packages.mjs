/**
 * Shared author inputs and bundle controls for the direct proof-erasure package matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	readVerifiedNativeComponent, readVerifiedNativeRuntime
} from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	assertDirectProofErasureIr
	, directProofErasureExport
	, directProofErasureFixture
	, directProofErasureModule
	, directProofErasureProofs
	, directProofErasureReview
	, directProofErasureTargets
} from "./direct-proof-erasure-fixture.mjs";

/**
 * Collapse consumer profiles that share one package target without allowing
 * their package coordinates to disagree.
 *
 * @param profiles - Consumer profiles selected for one canonical build.
 */
export const directProofErasureTargetConfiguration = profiles => {
	if(!Array.isArray(profiles) || !profiles.length
		|| profiles.some(profile => typeof profile !== "string"))
		throw new TypeError("Direct proof-erasure profiles must be a non-empty string array");
	if(new Set(profiles).size !== profiles.length)
		throw new TypeError("Direct proof-erasure profiles must be unique");
	const targets = {};
	for(const profile of profiles)
	{
		const selected = directProofErasureTargets[profile];
		if(!selected) throw new TypeError(`Unknown direct proof-erasure profile: ${profile}`);
		const [target, coordinate] = selected;
		if(Object.hasOwn(targets, target)
			&& canonicalJson(targets[target]) !== canonicalJson(coordinate))
			throw new TypeError(`Conflicting direct proof-erasure ${target} coordinates`);
		targets[target] = structuredClone(coordinate);
	}
	return targets;
};

/**
 * Copy the immutable fixture and materialize one ordinary or reviewed author root.
 *
 * @param t - Node test context that owns cleanup.
 * @param root0 - Route and selected consumer profiles.
 * @param root0.route - Ordinary source analysis or independent reviewed Binding IR.
 * @param root0.profiles - Consumer profiles whose package targets are prepared.
 */
export const prepareDirectProofErasureProject = async (t, { route, profiles }) => {
	if(!["ordinary", "reviewed"].includes(route))
		throw new TypeError(`Unknown direct proof-erasure route: ${route}`);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-erasure-"));
	t?.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(directProofErasureFixture, projectRoot, { recursive: true });
	const configuration = {
		schemaVersion: 1
		, modules: [directProofErasureModule]
		, ...route === "ordinary" ? { exports: [directProofErasureExport] } : {}
		, targets: directProofErasureTargetConfiguration(profiles)
	};
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
	const review = route === "reviewed" ? directProofErasureReview() : null;
	if(review) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
	return { directory, projectRoot, configuration, review, route, profiles: [...profiles] };
};

/**
 * Prove a canonical bundle retained two source proofs while exposing exactly
 * one UInt32 runtime parameter and reconstructing both witnesses in Lean.
 *
 * @param bundleRoot - Canonical bundle directory.
 */
export const assertDirectProofErasureBundle = async bundleRoot => {
	const irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
	const ir = JSON.parse(irBytes);
	assertDirectProofErasureIr(ir);
	const adapterBytes = await readFile(join(bundleRoot, "locks/compiler-adapters.json"));
	const adapters = JSON.parse(adapterBytes);
	assert.equal(adapters.exports.length, 1);
	const item = adapters.exports[0];
	assert.equal(item.bindingId, `lean:${directProofErasureExport}`);
	assert.equal(item.sourceDeclaration, directProofErasureExport);
	assert.deepEqual(item.parameters, [{ name: "value", leanType: "_root_.UInt32" }]);
	assert.equal(item.leanResultType, "_root_.UInt32");
	assert.deepEqual(item.erasedProofs, directProofErasureProofs);
	assert.equal(adapters.privateAbi.exports.length, 1);
	assert.equal(adapters.privateAbi.exports[0].parameters.length, 1);
	const leanBytes = await readFile(join(bundleRoot, "generated/LeanBridgeGenerated.lean"));
	const lean = leanBytes.toString("utf8");
	const escapedWrapper = item.wrapper.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	assert.match(lean, new RegExp(`def ${escapedWrapper} \\(value : _root_\\.UInt32\\) : _root_\\.UInt32 :=`, "u"));
	assert.match(lean, /_root_\.DirectProofErasure\.keep _root_\.True\.intro value _root_\.True\.intro/u);
	assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
	return {
		bindingIrSha256: hashBindingIr(ir)
		, bindingIrFileSha256: sha256(irBytes)
		, compilerAdaptersSha256: sha256(adapterBytes)
		, generatedLeanSha256: sha256(leanBytes)
		, runtimeParameters: item.parameters.length
		, erasedProofs: item.erasedProofs.length
	};
};

export const directProofErasureNativeRecordNames = Object.freeze([
	"artifacts.json", "binding-ir.json", "generated.lean", "metadata.json"
	, "model.json", "native-component.json"
]);
export const directProofErasureNativeComponentFactKeys = Object.freeze([
	"artifactsSha256", "bindingIrFileSha256", "bindingIrSha256", "erasedProofs"
	, "generatedLeanSha256", "metadataSha256", "modelSha256"
	, "nativeComponentReceiptSha256", "runtimeParameters"
]);

const canonicalDocument = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};

const assertNativeDirectProofErasureDocuments = ({
	artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
}) => {
	const artifacts = canonicalDocument(artifactsBytes, "artifacts.json");
	const ir = canonicalDocument(irBytes, "binding-ir.json");
	canonicalDocument(metadataBytes, "metadata.json");
	const model = canonicalDocument(modelBytes, "model.json");
	const receipt = canonicalDocument(receiptBytes, "native-component.json");
	assertDirectProofErasureIr(ir, directProofErasureModule, ["arg0", "value"]);
	assert.deepEqual(model.bindingIr, ir);
	assert.equal(model.bindingIrSha256, hashBindingIr(ir));
	assert.equal(model.exports.length, 1);
	const item = model.exports[0];
	assert.equal(item.name, directProofErasureExport);
	assert.equal(item.parameters.length, 1);
	assert.deepEqual(item.erasedProofs, directProofErasureProofs);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.equal(receipt.metadataSha256, sha256(metadataBytes));
	assert.equal(receipt.modelSha256, sha256(modelBytes));
	assert.equal(receipt.adaptersSha256, sha256(leanBytes));
	assert.equal(receipt.exports.length, 1);
	assert.equal(receipt.exports[0].declaration, directProofErasureExport);
	const lean = leanBytes.toString("utf8");
	assert.match(lean
		, /_root_\.DirectProofErasure\.keep _root_\.True\.intro a0 _root_\.True\.intro/u);
	assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
	assert.equal(artifacts.schemaVersion, 1);
	assert.equal(artifacts.profile, "native-library-v1");
	for(const [name, bytes] of [
		["binding-ir.json", irBytes], ["generated.lean", leanBytes]
		, ["metadata.json", metadataBytes], ["model.json", modelBytes]
		, ["native-component.json", receiptBytes]
	]) assert.deepEqual(artifacts.files[name]
		, { bytes: bytes.length, sha256: sha256(bytes) }, name);
	return {
		artifactsSha256: sha256(artifactsBytes)
		, bindingIrFileSha256: sha256(irBytes)
		, bindingIrSha256: model.bindingIrSha256
		, erasedProofs: item.erasedProofs.length
		, generatedLeanSha256: sha256(leanBytes)
		, metadataSha256: sha256(metadataBytes)
		, modelSha256: sha256(modelBytes)
		, nativeComponentReceiptSha256: sha256(receiptBytes)
		, runtimeParameters: item.parameters.length
	};
};

/**
 * Verify the authenticated native build products that package projections consume.
 *
 * @param outputRoot - Completed ordinary native release root.
 */
export const assertDirectProofErasureNativeComponent = async outputRoot => {
	const nativeRoot = join(outputRoot, "native/component");
	const runtime = await readVerifiedNativeRuntime(join(outputRoot, "native/runtime"));
	await readVerifiedNativeComponent(nativeRoot, runtime.identity);
	const [
		artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
	] = await Promise.all(directProofErasureNativeRecordNames.map(name =>
		readFile(join(nativeRoot, name))));
	return assertNativeDirectProofErasureDocuments({
		artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
	});
};

/**
 * Retain the exact authenticated native component inputs beside route evidence.
 *
 * @param records - Route evidence directory.
 * @param attempt - Independent build index.
 * @param outputRoot - Completed ordinary native release root.
 */
export const retainDirectProofErasureNativeComponent = async (
	records, attempt, outputRoot
) => {
	for(const name of directProofErasureNativeRecordNames)
		await saveLakeFile(records, `build-${attempt}/${name}`
			, await readFile(join(outputRoot, "native/component", name)));
};

/**
 * Recheck retained native component documents without trusting the producer report.
 *
 * @param read - Safe reader rooted at one route's evidence directory.
 * @param prefix - Independent build record prefix.
 */
export const checkDirectProofErasureNativeComponentRecords = async (
	read, prefix
) => {
	const [
		artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
	] = await Promise.all(directProofErasureNativeRecordNames.map(name =>
		read(prefix + name)));
	return assertNativeDirectProofErasureDocuments({
		artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
	});
};

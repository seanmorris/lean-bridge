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
import {
	readVerifiedPhpWasmCopiedComponent, readVerifiedPhpWasmCopiedRuntime
} from "../../src/build/php-wasm-copied-artifacts.mjs";
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
	const declaration = assertDirectProofErasureIr(
		ir, directProofErasureModule, ["arg0", "value"]
	);
	const parameterName = declaration.parameters[0].name;
	const adapterBytes = await readFile(join(bundleRoot, "locks/compiler-adapters.json"));
	const adapters = JSON.parse(adapterBytes);
	assert.equal(adapters.exports.length, 1);
	const item = adapters.exports[0];
	assert.equal(item.bindingId, `lean:${directProofErasureExport}`);
	assert.equal(item.sourceDeclaration, directProofErasureExport);
	assert.deepEqual(item.parameters, [{ name: parameterName, leanType: "_root_.UInt32" }]);
	assert.equal(item.leanResultType, "_root_.UInt32");
	assert.deepEqual(item.erasedProofs, directProofErasureProofs);
	assert.equal(adapters.privateAbi.exports.length, 1);
	assert.equal(adapters.privateAbi.exports[0].parameters.length, 1);
	const leanBytes = await readFile(join(bundleRoot, "generated/LeanBridgeGenerated.lean"));
	const lean = leanBytes.toString("utf8");
	const escapedWrapper = item.wrapper.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	assert.match(lean, new RegExp(`def ${escapedWrapper} \\(${parameterName} : _root_\\.UInt32\\) : _root_\\.UInt32 :=`, "u"));
	assert.match(lean, new RegExp(`_root_\\.DirectProofErasure\\.keep _root_\\.True\\.intro ${parameterName} _root_\\.True\\.intro`, "u"));
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
export const directProofErasurePhpWasmRecordNames = Object.freeze([
	"artifacts.json", "binding-ir.json", "generated.lean", "metadata.json"
	, "model.json", "php-wasm-component.json"
]);
export const directProofErasureNativeComponentFactKeys = Object.freeze([
	"artifactsSha256", "bindingIrFileSha256", "bindingIrSha256", "erasedProofs"
	, "generatedLeanSha256", "metadataSha256", "modelSha256"
	, "nativeComponentReceiptSha256", "runtimeParameters"
]);
export const directProofErasurePhpComponentFactKeys = Object.freeze([
	"bindingIrSha256", "erasedProofs", "runtimeParameters"
	, ...["native", "phpWasm"].flatMap(prefix => [
		"ArtifactsSha256", "BindingIrFileSha256", "ComponentReceiptSha256"
		, "GeneratedLeanSha256", "MetadataSha256", "ModelSha256"
	].map(suffix => `${prefix}${suffix}`))
]);

const canonicalDocument = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};

const assertDirectProofErasureComponentDocuments = ({
	artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
	, profile, receiptName
}) => {
	const artifacts = canonicalDocument(artifactsBytes, "artifacts.json");
	const ir = canonicalDocument(irBytes, "binding-ir.json");
	canonicalDocument(metadataBytes, "metadata.json");
	const model = canonicalDocument(modelBytes, "model.json");
	const receipt = canonicalDocument(receiptBytes, receiptName);
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
	assert.ok([receipt.exports[0].declaration, receipt.exports[0].name]
		.includes(directProofErasureExport));
	const lean = leanBytes.toString("utf8");
	assert.match(lean
		, /_root_\.DirectProofErasure\.keep _root_\.True\.intro a0 _root_\.True\.intro/u);
	assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
	assert.equal(artifacts.schemaVersion, 1);
	assert.equal(artifacts.profile, profile);
	assert.equal(receipt.profile, profile);
	for(const [name, bytes] of [
		["binding-ir.json", irBytes], ["generated.lean", leanBytes]
		, ["metadata.json", metadataBytes], ["model.json", modelBytes]
		, [receiptName, receiptBytes]
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
		, componentReceiptSha256: sha256(receiptBytes)
		, runtimeParameters: item.parameters.length
	};
};

const readComponentDocuments = async (root, names) => {
	const values = await Promise.all(names.map(name => readFile(join(root, name))));
	return {
		artifactsBytes: values[0], irBytes: values[1], leanBytes: values[2]
		, metadataBytes: values[3], modelBytes: values[4], receiptBytes: values[5]
	};
};

/**
 * Verify the authenticated native build products that package projections consume.
 *
 * @param outputRoot - Completed ordinary native release root.
 * @param prefix - Native runtime/component path within that release.
 */
export const assertDirectProofErasureNativeComponent = async (
	outputRoot, prefix = "native"
) => {
	const nativeRoot = join(outputRoot, prefix, "component");
	const runtime = await readVerifiedNativeRuntime(join(outputRoot, prefix, "runtime"));
	await readVerifiedNativeComponent(nativeRoot, runtime.identity);
	const fact = assertDirectProofErasureComponentDocuments({
		...await readComponentDocuments(nativeRoot
			, directProofErasureNativeRecordNames)
		, profile: "native-library-v1", receiptName: "native-component.json"
	});
	const { componentReceiptSha256, ...rest } = fact;
	return { ...rest, nativeComponentReceiptSha256: componentReceiptSha256 };
};

/**
 * Retain the exact authenticated native component inputs beside route evidence.
 *
 * @param records - Route evidence directory.
 * @param attempt - Independent build index.
 * @param outputRoot - Completed ordinary native release root.
 * @param prefix - Native runtime/component path within that release.
 * @param destination - Evidence subdirectory for the retained records.
 */
export const retainDirectProofErasureNativeComponent = async (
	records, attempt, outputRoot, prefix = "native", destination = ""
) => {
	for(const name of directProofErasureNativeRecordNames)
		await saveLakeFile(records, join(`build-${attempt}`, destination, name)
			, await readFile(join(outputRoot, prefix, "component", name)));
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
	const values = await Promise.all(directProofErasureNativeRecordNames.map(
		name => read(prefix + name)));
	const fact = assertDirectProofErasureComponentDocuments({
		artifactsBytes: values[0], irBytes: values[1], leanBytes: values[2]
		, metadataBytes: values[3], modelBytes: values[4], receiptBytes: values[5]
		, profile: "native-library-v1", receiptName: "native-component.json"
	});
	const { componentReceiptSha256, ...rest } = fact;
	return { ...rest, nativeComponentReceiptSha256: componentReceiptSha256 };
};

/**
 * Verify both independently compiled components in a combined PHP release.
 *
 * @param outputRoot - Completed combined PHP release root.
 */
export const assertDirectProofErasurePhpComponents = async outputRoot => {
	const native = await assertDirectProofErasureNativeComponent(
		join(outputRoot, "profiles/native"));
	const phpRoot = join(outputRoot, "profiles/php-wasm/php-wasm");
	const runtime = await readVerifiedPhpWasmCopiedRuntime(join(phpRoot, "runtime"));
	await readVerifiedPhpWasmCopiedComponent(join(phpRoot, "component")
		, runtime.identity);
	const phpWasm = assertDirectProofErasureComponentDocuments({
		...await readComponentDocuments(join(phpRoot, "component")
			, directProofErasurePhpWasmRecordNames)
		, profile: "php-wasm-copied-v1"
		, receiptName: "php-wasm-component.json"
	});
	assert.equal(phpWasm.bindingIrSha256, native.bindingIrSha256);
	return { native, phpWasm };
};

/**
 * Flatten both checked PHP component identities into one reproducibility fact.
 *
 * @param root0 - Independently verified native and PHP-Wasm facts.
 * @param root0.native - Checked 64-bit component consumed by native PHP.
 * @param root0.phpWasm - Checked 32-bit component consumed by PHP-Wasm.
 */
export const directProofErasurePhpComponentFact = ({ native, phpWasm }) => ({
	bindingIrSha256: native.bindingIrSha256
	, erasedProofs: native.erasedProofs
	, runtimeParameters: native.runtimeParameters
	, ...Object.fromEntries([native, phpWasm].flatMap((fact, index) => {
		const prefix = index === 0 ? "native" : "phpWasm";
		const receiptKey = index === 0
			? "nativeComponentReceiptSha256" : "componentReceiptSha256";
		return [
			["ArtifactsSha256", "artifactsSha256"]
			, ["BindingIrFileSha256", "bindingIrFileSha256"]
			, ["ComponentReceiptSha256", receiptKey]
			, ["GeneratedLeanSha256", "generatedLeanSha256"]
			, ["MetadataSha256", "metadataSha256"]
			, ["ModelSha256", "modelSha256"]
		].map(([suffix, key]) => [`${prefix}${suffix}`, fact[key]]);
	}))
});

/**
 * Retain both PHP compiler components beside one route's consumer evidence.
 *
 * @param records - Route evidence directory.
 * @param attempt - Independent build index.
 * @param outputRoot - Completed combined PHP release root.
 */
export const retainDirectProofErasurePhpComponents = async (
	records, attempt, outputRoot
) => {
	await retainDirectProofErasureNativeComponent(records, attempt
		, join(outputRoot, "profiles/native"), "native", "native");
	const root = join(outputRoot, "profiles/php-wasm/php-wasm/component");
	for(const name of directProofErasurePhpWasmRecordNames)
		await saveLakeFile(records, `build-${attempt}/php-wasm/${name}`
			, await readFile(join(root, name)));
};

/**
 * Recheck both retained PHP compiler components without trusting the report.
 *
 * @param read - Safe reader rooted at one route's evidence directory.
 * @param prefix - Independent build record prefix.
 */
export const checkDirectProofErasurePhpComponentRecords = async (
	read, prefix
) => {
	const native = await checkDirectProofErasureNativeComponentRecords(
		read, `${prefix}native/`);
	const values = await Promise.all(directProofErasurePhpWasmRecordNames.map(
		name => read(`${prefix}php-wasm/${name}`)));
	const phpWasm = assertDirectProofErasureComponentDocuments({
		artifactsBytes: values[0], irBytes: values[1], leanBytes: values[2]
		, metadataBytes: values[3], modelBytes: values[4], receiptBytes: values[5]
		, profile: "php-wasm-copied-v1"
		, receiptName: "php-wasm-component.json"
	});
	assert.equal(phpWasm.bindingIrSha256, native.bindingIrSha256);
	return { native, phpWasm };
};

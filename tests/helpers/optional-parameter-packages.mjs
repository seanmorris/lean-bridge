/**
 * Shared author inputs and bundle controls for the optional-parameter matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	readVerifiedNativeComponent, readVerifiedNativeRuntime
} from "../../src/build/native-artifacts.mjs";
import {
	readVerifiedPhpWasmCopiedComponent, readVerifiedPhpWasmCopiedRuntime
} from "../../src/build/php-wasm-copied-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertOptionalParameterIr
	, optionalParameterBinder
	, optionalParameterExports
	, optionalParameterFixture
	, optionalParameterModule
	, optionalParameterReview
	, optionalParameterTargets
} from "./optional-parameter-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Collapse profiles sharing one package target while rejecting coordinate
 * drift between aliases such as Node/browser and Java/Kotlin.
 *
 * @param profiles - Consumer profiles selected for one canonical build.
 */
export const optionalParameterTargetConfiguration = profiles => {
	if(!Array.isArray(profiles) || !profiles.length
		|| profiles.some(profile => typeof profile !== "string"))
		throw new TypeError("Optional-parameter profiles must be a non-empty string array");
	if(new Set(profiles).size !== profiles.length)
		throw new TypeError("Optional-parameter profiles must be unique");
	const targets = {};
	for(const profile of profiles)
	{
		const selected = optionalParameterTargets[profile];
		if(!selected) throw new TypeError(`Unknown optional-parameter profile: ${profile}`);
		const [target, coordinate] = selected;
		if(Object.hasOwn(targets, target)
			&& canonicalJson(targets[target]) !== canonicalJson(coordinate))
			throw new TypeError(`Conflicting optional-parameter ${target} coordinates`);
		targets[target] = structuredClone(coordinate);
	}
	return targets;
};

/**
 * Copy the immutable Lean fixture and materialize one ordinary or independently
 * reviewed author root.
 *
 * @param t - Node test context that owns cleanup.
 * @param root0 - Route and selected consumer profiles.
 * @param root0.route - Ordinary source analysis or independent reviewed IR.
 * @param root0.profiles - Consumer profiles whose targets are prepared.
 */
export const prepareOptionalParameterProject = async (t, { route, profiles }) => {
	if(!["ordinary", "reviewed"].includes(route))
		throw new TypeError(`Unknown optional-parameter route: ${route}`);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-optional-parameters-"));
	t?.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(optionalParameterFixture, projectRoot, { recursive: true });
	const configuration = {
		schemaVersion: 1
		, modules: [optionalParameterModule]
		, ...route === "ordinary" ? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(profiles)
	};
	await saveLakeFile(projectRoot, "lean-bridge.exports.json"
		, canonicalJson(configuration));
	const review = route === "reviewed" ? optionalParameterReview() : null;
	if(review) await saveLakeFile(projectRoot, "api.binding-ir.json"
		, canonicalJson(review));
	return {
		directory, projectRoot, configuration, review, route
		, profiles: [...profiles]
	};
};

/**
 * Prove that a canonical bundle retained all seven authenticated defaults while
 * keeping the compiler ABI full arity.
 *
 * @param bundleRoot - Canonical bundle directory.
 * @param route - Ordinary source analysis or independent reviewed IR.
 */
export const assertOptionalParameterBundle = async (bundleRoot, route) => {
	const binder = optionalParameterBinder(route);
	const irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
	const ir = JSON.parse(irBytes);
	const declarations = assertOptionalParameterIr(ir, [binder]);
	const adapterBytes = await readFile(join(bundleRoot, "locks/compiler-adapters.json"));
	const adapters = JSON.parse(adapterBytes);
	assert.equal(adapters.exports.length, declarations.length);
	assert.equal(adapters.privateAbi.exports.length, declarations.length);
	for(const declaration of declarations)
	{
		const item = adapters.exports.find(entry =>
			entry.bindingId === declaration.id);
		assert.ok(item, declaration.id);
		assert.equal(item.parameters.length, 1);
		assert.equal(item.parameters[0].name, binder);
		const privateExport = adapters.privateAbi.exports.find(entry =>
			entry.bindingId === declaration.id);
		assert.ok(privateExport, declaration.id);
		assert.equal(privateExport.parameters.length, 1);
	}
	const leanBytes = await readFile(
		join(bundleRoot, "generated/LeanBridgeGenerated.lean"));
	const lean = leanBytes.toString("utf8");
	assert.equal((lean.match(/@\[export lean_bridge_[a-f0-9]+_lean\]/gu)
		?? []).length, declarations.length);
	assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
	return {
		bindingIrSha256: hashBindingIr(ir)
		, bindingIrFileSha256: sha256(irBytes)
		, compilerAdaptersSha256: sha256(adapterBytes)
		, generatedLeanSha256: sha256(leanBytes)
		, declarations: declarations.length
		, authenticatedDefaults: declarations.filter(declaration =>
			declaration.parameters[0].optional).length
	};
};

export const optionalParameterNativeRecordNames = Object.freeze([
	"artifacts.json", "binding-ir.json", "generated.lean", "metadata.json"
	, "model.json", "native-component.json"
]);
export const optionalParameterPhpWasmRecordNames = Object.freeze([
	"artifacts.json", "binding-ir.json", "generated.lean", "metadata.json"
	, "model.json", "php-wasm-component.json"
]);
export const optionalParameterComponentFactKeys = Object.freeze([
	"artifactsSha256", "authenticatedDefaults", "bindingIrFileSha256"
	, "bindingIrSha256", "componentReceiptSha256", "declarations"
	, "generatedLeanSha256", "metadataSha256", "modelSha256"
]);
export const optionalParameterPhpComponentFactKeys = Object.freeze([
	"authenticatedDefaults", "bindingIrSha256", "declarations"
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

const assertOptionalParameterComponentDocuments = ({
	artifactsBytes, irBytes, leanBytes, metadataBytes, modelBytes, receiptBytes
	, profile, receiptName
}) => {
	const artifacts = canonicalDocument(artifactsBytes, "artifacts.json");
	const ir = canonicalDocument(irBytes, "binding-ir.json");
	canonicalDocument(metadataBytes, "metadata.json");
	const model = canonicalDocument(modelBytes, "model.json");
	const receipt = canonicalDocument(receiptBytes, receiptName);
	const declarations = assertOptionalParameterIr(ir, ["arg0", "value0"]);
	assert.equal(artifacts.schemaVersion, 1);
	assert.equal(artifacts.profile, profile);
	assert.equal(receipt.profile, profile);
	assert.deepEqual(model.bindingIr, ir);
	assert.equal(model.bindingIrSha256, hashBindingIr(ir));
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.equal(receipt.metadataSha256, sha256(metadataBytes));
	assert.equal(receipt.modelSha256, sha256(modelBytes));
	assert.equal(receipt.adaptersSha256, sha256(leanBytes));
	assert.equal(receipt.exports.length, declarations.length);
	assert.doesNotMatch(leanBytes.toString(), /(?:sorry|unsafeCast|\baxiom\b)/u);
	for(const [name, bytes] of [
		["binding-ir.json", irBytes], ["generated.lean", leanBytes]
		, ["metadata.json", metadataBytes], ["model.json", modelBytes]
		, [receiptName, receiptBytes]
	]) assert.deepEqual(artifacts.files[name]
		, { bytes: bytes.length, sha256: sha256(bytes) }, name);
	return {
		artifactsSha256: sha256(artifactsBytes)
		, authenticatedDefaults: declarations.filter(declaration =>
			declaration.parameters[0].optional).length
		, bindingIrFileSha256: sha256(irBytes)
		, bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(receiptBytes)
		, declarations: declarations.length
		, generatedLeanSha256: sha256(leanBytes)
		, metadataSha256: sha256(metadataBytes)
		, modelSha256: sha256(modelBytes)
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
 * Verify the native component actually consumed by non-wasm packages.
 *
 * @param outputRoot - Completed native or native-profile release root.
 * @param prefix - Relative native runtime and component directory.
 */
export const assertOptionalParameterNativeComponent = async (
	outputRoot, prefix = "native"
) => {
	const runtimeRoot = join(outputRoot, prefix, "runtime");
	const componentRoot = join(outputRoot, prefix, "component");
	const runtime = await readVerifiedNativeRuntime(runtimeRoot);
	await readVerifiedNativeComponent(componentRoot, runtime.identity);
	return assertOptionalParameterComponentDocuments({
		...await readComponentDocuments(
			componentRoot, optionalParameterNativeRecordNames)
		, profile: "native-library-v1", receiptName: "native-component.json"
	});
};

/**
 * Retain the closed native compiler records beside route evidence.
 *
 * @param records - Route evidence directory.
 * @param attempt - Independent build index.
 * @param outputRoot - Completed release root.
 * @param prefix - Relative native runtime and component directory.
 * @param destination - Relative evidence subdirectory.
 */
export const retainOptionalParameterNativeComponent = async (
	records, attempt, outputRoot, prefix = "native", destination = ""
) => {
	const root = join(outputRoot, prefix, "component");
	for(const name of optionalParameterNativeRecordNames)
		await saveLakeFile(records, join(`build-${attempt}`, destination, name)
			, await readFile(join(root, name)));
};

/**
 * Recheck retained native compiler records without trusting the report.
 *
 * @param read - Safe reader rooted at one route's evidence directory.
 * @param prefix - Independent build record prefix.
 */
export const checkOptionalParameterNativeComponentRecords = async (
	read, prefix
) => {
	const values = await Promise.all(optionalParameterNativeRecordNames.map(
		name => read(prefix + name)));
	return assertOptionalParameterComponentDocuments({
		artifactsBytes: values[0], irBytes: values[1], leanBytes: values[2]
		, metadataBytes: values[3], modelBytes: values[4]
		, receiptBytes: values[5], profile: "native-library-v1"
		, receiptName: "native-component.json"
	});
};

/**
 * Verify both independently compiled profiles in a combined PHP release.
 *
 * @param outputRoot - Completed combined PHP release root.
 */
export const assertOptionalParameterPhpComponents = async outputRoot => {
	const nativeRoot = join(outputRoot, "profiles/native");
	const phpRoot = join(outputRoot, "profiles/php-wasm/php-wasm");
	const native = await assertOptionalParameterNativeComponent(nativeRoot);
	const runtime = await readVerifiedPhpWasmCopiedRuntime(join(phpRoot, "runtime"));
	await readVerifiedPhpWasmCopiedComponent(join(phpRoot, "component")
		, runtime.identity);
	const phpWasm = assertOptionalParameterComponentDocuments({
		...await readComponentDocuments(
			join(phpRoot, "component"), optionalParameterPhpWasmRecordNames)
		, profile: "php-wasm-copied-v1"
		, receiptName: "php-wasm-component.json"
	});
	assert.equal(phpWasm.bindingIrSha256, native.bindingIrSha256);
	return { native, phpWasm };
};

/**
 * Flatten the two compiler profiles into a closed reproducibility fact.
 *
 * @param root0 - Independently verified native and PHP-Wasm facts.
 * @param root0.native - Native PHP compiler fact.
 * @param root0.phpWasm - PHP-Wasm compiler fact.
 */
export const optionalParameterPhpComponentFact = ({ native, phpWasm }) => ({
	authenticatedDefaults: native.authenticatedDefaults
	, bindingIrSha256: native.bindingIrSha256
	, declarations: native.declarations
	, ...Object.fromEntries([native, phpWasm].flatMap((fact, index) => {
		const prefix = index === 0 ? "native" : "phpWasm";
		return [
			["ArtifactsSha256", "artifactsSha256"]
			, ["BindingIrFileSha256", "bindingIrFileSha256"]
			, ["ComponentReceiptSha256", "componentReceiptSha256"]
			, ["GeneratedLeanSha256", "generatedLeanSha256"]
			, ["MetadataSha256", "metadataSha256"]
			, ["ModelSha256", "modelSha256"]
		].map(([suffix, key]) => [`${prefix}${suffix}`, fact[key]]);
	}))
});

/**
 * Retain both PHP profile compiler records beside route evidence.
 *
 * @param records - Route evidence directory.
 * @param attempt - Independent build index.
 * @param outputRoot - Completed combined PHP release root.
 */
export const retainOptionalParameterPhpComponents = async (
	records, attempt, outputRoot
) => {
	await retainOptionalParameterNativeComponent(records, attempt
		, join(outputRoot, "profiles/native"), "native", "native");
	const root = join(outputRoot, "profiles/php-wasm/php-wasm/component");
	for(const name of optionalParameterPhpWasmRecordNames)
		await saveLakeFile(records, `build-${attempt}/php-wasm/${name}`
			, await readFile(join(root, name)));
};

/**
 * Recheck both retained PHP profile compiler record sets.
 *
 * @param read - Safe reader rooted at one route's evidence directory.
 * @param prefix - Independent build record prefix.
 */
export const checkOptionalParameterPhpComponentRecords = async (
	read, prefix
) => {
	const native = await checkOptionalParameterNativeComponentRecords(
		read, `${prefix}native/`);
	const values = await Promise.all(optionalParameterPhpWasmRecordNames.map(
		name => read(`${prefix}php-wasm/${name}`)));
	const phpWasm = assertOptionalParameterComponentDocuments({
		artifactsBytes: values[0], irBytes: values[1], leanBytes: values[2]
		, metadataBytes: values[3], modelBytes: values[4]
		, receiptBytes: values[5], profile: "php-wasm-copied-v1"
		, receiptName: "php-wasm-component.json"
	});
	assert.equal(phpWasm.bindingIrSha256, native.bindingIrSha256);
	return { native, phpWasm };
};

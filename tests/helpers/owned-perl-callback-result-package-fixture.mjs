/**
 * Build unit-only CPAN payloads from authenticated compiler inputs.
 * Library bytes are synthetic; these fixtures never claim native execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { generateOwnedPerlPackage } from "../../src/backends/perl/owned-package.mjs";
import { renderOwnedPerlCallbackBuild } from "../../src/backends/perl/owned-callback-build.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";

let reports;
const inputs = async () => {
	if(!reports)
	{
		const bytes = await readFile("docs/evidence/owned-jvm-callback-results-20261003.json");
		assert.equal(sha256(bytes), "ce3855e16ac23fed6c437def1c09a9c27c7c3ac54c2d3298141bad60c78d3310");
		reports = unpackOwnedCallbackReports(JSON.parse(bytes).archive);
	}
	return reports;
};

/**
 * Reconstruct generated source and contracts, with explicitly fake libraries.
 *
 * @param mode - Original ordinary or reviewed compiler input.
 * @param combined - Include export anchors, transfers and receiver capabilities.
 * @param hostCallbacks - Independently enable host descriptors and trampolines.
 */
export const ownedPerlCallbackPackageFixture = async (mode, combined, hostCallbacks) => {
	const report = (await inputs())[`build/owned-jvm-callback-results/${mode}-${combined ? "combined" : "no-host"}-package.json`];
	assert.ok(report);
	const model = createCompiledNativeModel(report.input, {
		ownedGraphs: true, ownedHostCallbacks: hostCallbacks
		, ownedCallbackResultAnchors: true, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined
	});
	const adapters = generateCompiledNativeLeanAdapters(model);
	const library = Buffer.from("unit-only synthetic component library"), gmp = Buffer.from("unit-only synthetic GMP library");
	const receipt = { ...structuredClone(report.componentReceipt)
		, modelSha256: sha256(canonicalJson(model))
		, bindingIrSha256: model.bindingIrSha256
		, metadataSha256: sha256(canonicalJson(report.input.metadata))
		, headerSha256: sha256(adapters.header)
		, adaptersSha256: sha256(adapters.leanSource)
		, allocationGuardSha256: sha256(nativeAllocationGuardHeader)
		, initializer: `initialize_${adapters.module}`
		, nativeLibrary: { bytes: library.length, sha256: sha256(library) }
	};
	delete receipt.callbackSourceSha256;
	if(hostCallbacks) receipt.callbackSourceSha256 = sha256(adapters.callbackSource);
	const moduleName = "LeanBridge::OwnedProbe", runtimeIdentity = "3".repeat(64);
	const generated = generateOwnedPerlPackage({ model
		, metadata: report.input.metadata, receipt: { ...receipt, runtimeIdentity }
		, moduleName, gmpSha256: sha256(gmp) });
	const manifest = { schemaVersion: 1, ecosystem: "cpan", backend: "perl"
		, module: moduleName, distribution: "LeanBridge-OwnedProbe", version: "0.001"
		, runtimeVersion: "0.002" + "1".repeat(78) + "1"
		, runtimeIdentity, nativeRuntimeIdentity: receipt.runtimeIdentity
		, ownedValues: generated.owned, files: {} };
	const files = new Map(Object.entries(generated.files).map(([path, source]) => [path
		, Buffer.from(path.endsWith(".pm")
			? source.replace("use LeanBridge::Runtime;", `use LeanBridge::Runtime;\ndie "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${manifest.runtimeVersion}';`)
			: source)]));
	const json = (path, value) => files.set(path, Buffer.from(canonicalJson(value)));
	json("model.json", model); json("binding-ir.json", model.bindingIr);
	json("native-component.json", receipt); json("metadata.json", report.input.metadata);
	files.set("component.h", Buffer.from(adapters.header)); files.set("generated.lean", Buffer.from(adapters.leanSource));
	files.set("allocation-guard.h", Buffer.from(nativeAllocationGuardHeader));
	if(hostCallbacks) files.set("callbacks.c", Buffer.from(adapters.callbackSource));
	files.set(`lib/LeanBridge/OwnedProbe/native/${receipt.library}`, library);
	files.set("lib/LeanBridge/OwnedProbe/native/libgmp-lean-bridge.so.10", gmp);
	files.set("LeanBridgeBuild.pm", Buffer.from(renderOwnedPerlCallbackBuild(
		await readFile("src/backends/perl/Build.pm", "utf8")
		, await readFile("src/backends/perl/BuildCallbackResults.pm", "utf8")
		, { moduleName, model })));
	json("META.json", { prereqs: { configure: { requires: { "LeanBridge::Runtime": `== ${manifest.runtimeVersion}` } }
		, runtime: { requires: { "LeanBridge::Runtime": `== ${manifest.runtimeVersion}` } } } });
	manifest.files = Object.fromEntries([...files].map(([path, bytes]) => [path, sha256(bytes)]));
	return { manifest, files, model, generated, receipt };
};

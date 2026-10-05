/**
 * Reuse frozen compiler inputs for pure WIT generation, not runtime acceptance.
 * Component and dependency bytes below are explicitly synthetic unit fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { compileOwnedWitGraphModel } from "../../src/backends/wit/owned-graph-model.mjs";
import { ownedWitSources, ownedWitValueContract } from "../../src/build/owned-wit-artifacts.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";

let reports;
const compilerInputs = async () => {
	if(!reports)
	{
		const bytes = await readFile("docs/evidence/owned-jvm-callback-results-20261003.json");
		assert.equal(sha256(bytes), "ce3855e16ac23fed6c437def1c09a9c27c7c3ac54c2d3298141bad60c78d3310");
		reports = unpackOwnedCallbackReports(JSON.parse(bytes).archive);
	}
	return reports;
};

/**
 * Generate an explicitly unexecuted host and its closed ownership contract.
 *
 * @param mode - Ordinary-source or reviewed-IR compiler input.
 * @param variant - No-host, host-only or combined ownership capabilities.
 */
export const witOwnedCallbackResultFixture = async (mode, variant) => {
	assert.ok(["ordinary", "reviewed"].includes(mode));
	assert.ok(["no-host", "host", "combined"].includes(variant));
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const report = (await compilerInputs())[`build/owned-jvm-callback-results/${mode}-${combined ? "combined" : "no-host"}-package.json`];
	const options = { callbackResultAnchors: true, hostCallbacks
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const input = { ...report.input, ...options };
	const model = createCompiledNativeModel(input, { ownedGraphs: true
		, ownedHostCallbacks: hostCallbacks
		, ownedCallbackResultAnchors: true, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined });
	const identity = name => ({ bytes: Buffer.byteLength(name), sha256: sha256(name) });
	const settings = {}, runtimeIdentity = sha256("unit-only synthetic runtime");
	const receipt = { schemaVersion: 7, library: "libcallback_unit.so"
		, nativeLibrary: identity("unit-only synthetic component library")
		, modelSha256: sha256(canonicalJson(model)), runtimeIdentity
		, callbackResultAnchors: model.ownedGraph.callbackResultAnchors };
	const runtime = { files: {
		"lib/libLean_shared.so": identity("unit-only synthetic Lean library")
		, "lib/libLean_bridge.so": identity("unit-only synthetic bridge library")
	} };
	const evidence = { model, receipt, runtime, runtimeIdentity
		, inputs: input, settings
		, projection: compileOwnedWitGraphModel(model.bindingIr, settings, options) };
	// Empty Component Model header. No generated export is executed by this fixture.
	const component = Buffer.from([0, 97, 115, 109, 13, 0, 1, 0]);
	const sources = ownedWitSources(evidence, component
		, { "lib/libwasmtime.so": identity("unit-only synthetic Wasmtime library") }
		, { "lib/libgmp.so.10": identity("unit-only synthetic GMP library") });
	const p = sources.generated.values.prefix;
	const compiled = { schemaVersion: 2, profile: "native-wit-v1"
		, bindingIrSha256: model.bindingIrSha256, runtimeIdentity
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, library: `lib${p}.so`
		, component: `component/${evidence.projection.name}.wasm`
		, settings, glibcMinimumVersion: "2.38", wasmTools: "wasm-tools 1.245.1"
		, ownedValues: ownedWitValueContract(model, sources)
		, dependencies: sources.dependencies
		, files: Object.fromEntries(Object.entries(sources.files).map(([path, source]) =>
			[path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])) };
	return { input, options, model, component, evidence, sources, compiled };
};

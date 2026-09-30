/**
 * Reconstructible sources and descriptor for one owned JavaScript side module.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateTransferLeaseSource } from "../backends/native/owned-aggregate-transfers.mjs";
import { generateOwnedWasmComponent } from "../backends/javascript/owned-wasm-component.mjs";
import { generateOwnedWasmBroker } from "../backends/javascript/owned-wasm-broker.mjs";
import { nativeAllocationGuardHeader } from "./native-allocation-guard.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "./javascript-wasm-owned-model.mjs";

/**
 * Bind the control descriptor and every compiled adapter to fresh Lean metadata.
 * The shared runtime supplies the broker. Components never compile a second one.
 *
 * @param model - Authenticated wasm32 model.
 * @param metadata - Captured Lean compiler report.
 * @param adapters - Typed Lean code and C declarations selected for compilation.
 */
export const generateCompiledJavaScriptWasmOwned = (model, metadata, adapters) => {
	const inputs = { metadata, sourceIdentity: model.sourceIdentity, component: model.component };
	if(canonicalJson(createOwnedJavaScriptWasmModel(inputs)) !== canonicalJson(model)
		|| canonicalJson(generateOwnedJavaScriptWasmLeanAdapters(model)) !== canonicalJson(adapters))
		throw new TypeError("JavaScript ownership sources differ from compiler inputs");
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const native = generateOwnedNativeValueAdapters({ ...inputs, wordBits: 32, hostCallbacks: true, transferredInputs });
	const component = generateOwnedWasmComponent(native);
	if(native.carriers.leanSource !== adapters.leanSource || native.carriers.module !== adapters.module)
		throw new TypeError("JavaScript ownership carrier source drift");
	const files = { "owned/carriers.h": adapters.header
		, "owned/owned-values.h": native.typesHeader
		, "owned/owned-values-codec.h": native.source
		, "owned/owned-leases.h": transferredInputs ? ownedAggregateTransferLeaseSource : ownedAggregateLeaseSource
		, "owned/owned-js-layout.h": component.layout.assertions
		, "owned/lean_bridge_native_runtime.h": generateOwnedWasmBroker().header
		, "owned/callbacks.c": adapters.callbackSource
		, "owned/allocation-guard.h": nativeAllocationGuardHeader
		, "owned/component.c": component.source
		, "private-abi.json": canonicalJson(component.privateAbi) };
	return { files, privateAbi: component.privateAbi
		, metadataHash: component.metadataHash
		, sources: ["owned/callbacks.c", "owned/component.c"]
		, allocationGuard: "owned/allocation-guard.h"
		, receipt: { schemaVersion: transferredInputs ? 2 : 1
			, transport: "owned-wasm32-control-v1"
			, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, layoutSha256: model.ownedGraph.layoutSha256
			, metadataHash: component.metadataHash
			, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) } };
};

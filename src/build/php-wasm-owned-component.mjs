/**
 * Reconstructible Zend ownership sources for compiled PHP-Wasm packages.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseRuntime } from "../backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateTransferRuntime } from "../backends/native/owned-aggregate-transfers.mjs";
import { generateOwnedPhpZendExtension } from "../backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../backends/php/owned-zend-php.mjs";
import { nativeAllocationGuardHeader } from "./native-allocation-guard.mjs";
import { createOwnedPhpWasmModel, generateOwnedPhpWasmLeanAdapters } from "./php-wasm-owned-model.mjs";

/**
 * Reconcile captured compiler inputs before generating any package source.
 * Every source file is compared again by the artifact reader.
 *
 * @param model - Authenticated wasm32 owned component.
 * @param metadata - Captured Lean compiler report.
 * @param adapters - Typed Lean and C declarations selected for compilation.
 */
export const generateCompiledPhpWasmOwned = (model, metadata, adapters) => {
	const anchoredResults = Boolean(model.ownedGraph?.resultAnchors);
	const inputs = { metadata, sourceIdentity: model.sourceIdentity, component: model.component, anchoredResults };
	if(canonicalJson(createOwnedPhpWasmModel(inputs)) !== canonicalJson(model)
		|| canonicalJson(generateOwnedPhpWasmLeanAdapters(model)) !== canonicalJson(adapters))
		throw new TypeError("PHP-Wasm ownership sources differ from compiler inputs");
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const native = generateOwnedNativeValueAdapters({ ...inputs, wordBits: 32, hostCallbacks: true, transferredInputs });
	const extension = generateOwnedPhpZendExtension(native), php = generateOwnedPhpZendPhp(extension.model);
	if(native.carriers.leanSource !== adapters.leanSource || native.carriers.module !== adapters.module)
		throw new TypeError("PHP-Wasm ownership carrier source drift");
	const manifest = { schemaVersion: anchoredResults ? 3 : transferredInputs ? 2 : 1
		, profile: "php-wasm-owned-zend-v1"
		, bindingIrSha256: model.bindingIrSha256
		, layoutSha256: extension.model.layoutSha256
		, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
		, ...anchoredResults ? { resultAnchors: model.ownedGraph.resultAnchors } : {}
		, integerBits: 32, wordBits: 32, namespace: extension.model.namespace
		, extension: extension.model.stem
		, phpFiles: Object.keys(php).sort()
		, exports: extension.model.functions.map(fn => ({ bindingId: fn.id
			, name: fn.publicName
			, entry: `${extension.model.transport}\\call${fn.index}`
			, parameters: fn.parameters, result: fn.result })) };
	const files = { ...php
		, "owned/carriers.h": adapters.header
		, "owned/owned-values.h": native.typesHeader
		, "owned/owned-values-codec.h": native.source
		, "owned/owned-leases.h": transferredInputs ? ownedAggregateTransferRuntime({ anchoredResults }) : ownedAggregateLeaseRuntime({ anchoredResults })
		, "owned/callbacks.c": adapters.callbackSource
		, "owned/allocation-guard.h": nativeAllocationGuardHeader
		, [`extension/${manifest.extension}.c`]: extension.source
		, "owned-zend-manifest.json": canonicalJson(manifest) };
	return { files, manifest, zendManifestPath: "owned-zend-manifest.json"
		, allocationGuard: "owned/allocation-guard.h"
		, sources: ["owned/callbacks.c", `extension/${manifest.extension}.c`]
		, receipt: { schemaVersion: anchoredResults ? 3 : transferredInputs ? 2 : 1
			, transport: "owned-zend-v1"
			, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, ...anchoredResults ? { resultAnchors: model.ownedGraph.resultAnchors } : {}
			, layoutSha256: manifest.layoutSha256
			, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) } };
};

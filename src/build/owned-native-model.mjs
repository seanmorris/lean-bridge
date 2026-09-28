/**
 * Compiler-authenticated ownership-aware native component artifacts.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { generateOwnedAggregateCarriers, generateOwnedBindingCarriers } from "./owned-aggregate-carriers.mjs";

const callbackSource = carriers => carriers.callbackSource.replace('#include "carriers.h"', '#include "component.h"');
const callbackCapability = carriers => ({ schemaVersion: 1
	, lifetime: "call", recovery: "typed-value-v1"
	, signatures: carriers.hostCallbacks
	, trampolineSha256: sha256(callbackSource(carriers)) });

/**
 * Retain complete v4 semantics and measured compiler evidence for package readers.
 *
 * @param options - Fresh compiler report, source identities and package coordinates.
 */
export const createOwnedCompiledNativeModel = options => {
	if(options.moduleName !== undefined) throw new TypeError("Owned native models cannot contain a host-language namespace");
	const { metadata, sourceIdentity, component } = options;
	const hostCallbacks = options.hostCallbacks ?? false;
	if(typeof hostCallbacks !== "boolean") throw new TypeError("Owned host callback capability must be explicit");
	const elaborated = projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true, ownedGraphs: true });
	const carriers = generateOwnedAggregateCarriers(options);
	return Object.freeze({ schemaVersion: hostCallbacks ? 7 : 6
		, profile: "native-library-v1"
		, pointerBits: 64, byteOrder: "little", component
		, bindingIr: carriers.model.bindingIr
		, bindingIrSha256: carriers.model.bindingIrSha256
		, sourceIdentity, types: []
		, exports: elaborated.declarations.map(item => {
			const declaration = carriers.model.bindingIr.declarations.find(value =>
				(value.source.extensions["lean-lang.org/specialization"]?.name ?? value.source.declaration) === item.name);
			if(!declaration) throw new TypeError("Owned native export lacks a compiler-selected declaration");
			return { ...item, bindingId: declaration.id, symbol: carriers.symbols.exports[declaration.id] };
		})
		, ownedGraph: { schemaVersion: hostCallbacks ? 2 : 1, module: carriers.module
			, metadataSha256: elaborated.sha256, symbols: carriers.symbols
			, ...(hostCallbacks ? { hostCallbacks: callbackCapability(carriers) } : {}) } });
};

/**
 * Generate exactly the helpers described by a reconstructed owned component.
 *
 * @param model - Independently authenticated native model, never a copied graph.
 */
export const generateOwnedNativeLeanAdapters = model => {
	const hostCallbacks = model.schemaVersion === 7;
	if(![6, 7].includes(model.schemaVersion) || model.profile !== "native-library-v1"
		|| model.pointerBits !== 64 || model.byteOrder !== "little" || model.ownedGraph?.schemaVersion !== (hostCallbacks ? 2 : 1)
		|| (!hostCallbacks && model.ownedGraph.hostCallbacks !== undefined))
		throw new TypeError("Owned native component differs from the supported transport");
	const generated = generateOwnedBindingCarriers({ document: model.bindingIr
		, sourceIdentity: model.sourceIdentity, declarations: model.exports
		, metadataSha256: model.ownedGraph.metadataSha256, hostCallbacks });
	if(generated.model.bindingIrSha256 !== model.bindingIrSha256 || generated.module !== model.ownedGraph.module
		|| canonicalJson(generated.symbols) !== canonicalJson(model.ownedGraph.symbols)
		|| model.exports.some(item => item.symbol !== generated.symbols.exports[item.bindingId])
		|| (hostCallbacks && canonicalJson(model.ownedGraph.hostCallbacks) !== canonicalJson(callbackCapability(generated))))
		throw new TypeError("Owned native carrier identity differs from the checked contract");
	return { module: generated.module, leanSource: generated.leanSource
		, header: generated.header
		, ...(hostCallbacks ? { callbackSource: callbackSource(generated) } : {}) };
};
